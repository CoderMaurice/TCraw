import { z } from 'zod';
import { logger } from '@librechat/data-schemas';
import type {
  AllMethods,
  DingTalkBindingSummary,
  IDingTalkBinding,
  IUser,
} from '@librechat/data-schemas';
import type { NextFunction, Request, Response } from 'express';
import type { Types } from 'mongoose';
import type { DingTalkRuntimeControl } from './types';

const upsertBindingSchema = z.object({
  clientId: z.string().trim().min(1).max(256),
  clientSecret: z.string().trim().min(1).max(512).optional(),
  robotCode: z.string().trim().max(256).optional(),
  enabled: z.boolean().default(true),
});

export interface AuthenticatedDingTalkRequest extends Request {
  user?: IUser & { id: string };
  apiKeyId?: Types.ObjectId;
}

export interface DingTalkHandlerDependencies {
  getAgent: AllMethods['getAgent'];
  createAgentApiKey: AllMethods['createAgentApiKey'];
  deleteAgentApiKey: AllMethods['deleteAgentApiKey'];
  getDingTalkBindingByAgent: AllMethods['getDingTalkBindingByAgent'];
  getDingTalkBindingByApiKeyId: AllMethods['getDingTalkBindingByApiKeyId'];
  upsertDingTalkBinding: AllMethods['upsertDingTalkBinding'];
  deleteDingTalkBinding: AllMethods['deleteDingTalkBinding'];
  runtime: DingTalkRuntimeControl;
}

export interface DingTalkHandlers {
  getBinding(req: AuthenticatedDingTalkRequest, res: Response): Promise<void>;
  upsertBinding(req: AuthenticatedDingTalkRequest, res: Response): Promise<void>;
  deleteBinding(req: AuthenticatedDingTalkRequest, res: Response): Promise<void>;
  checkInternalBindingAccess(
    req: AuthenticatedDingTalkRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
}

function toSummary(binding: IDingTalkBinding): DingTalkBindingSummary {
  return {
    id: binding._id.toString(),
    agentId: binding.agentId,
    clientId: binding.clientId,
    robotCode: binding.robotCode,
    enabled: binding.enabled,
    status: binding.status,
    hasClientSecret: true,
    lastConnectedAt: binding.lastConnectedAt,
    lastError: binding.lastError,
    createdAt: binding.createdAt,
    updatedAt: binding.updatedAt,
  };
}

async function requireAgentOwner(
  req: AuthenticatedDingTalkRequest,
  res: Response,
  getAgent: AllMethods['getAgent'],
) {
  const agentId = req.params.agentId;
  const userId = req.user?.id;
  const agent = await getAgent({ id: agentId });

  if (!agent) {
    res.status(404).json({ error: 'Digital avatar not found' });
    return null;
  }
  if (!userId || agent.author.toString() !== userId) {
    res.status(403).json({ error: 'Only the digital avatar owner can configure DingTalk' });
    return null;
  }
  return agent;
}

export function createDingTalkHandlers(deps: DingTalkHandlerDependencies): DingTalkHandlers {
  const getBinding = async (req: AuthenticatedDingTalkRequest, res: Response): Promise<void> => {
    try {
      const agent = await requireAgentOwner(req, res, deps.getAgent);
      if (!agent) {
        return;
      }
      const binding = await deps.getDingTalkBindingByAgent(agent.id);
      res.status(200).json({ binding: binding ? toSummary(binding) : null });
    } catch (error) {
      logger.error('[DingTalk] Failed to get binding', error);
      res.status(500).json({ error: 'Failed to get DingTalk binding' });
    }
  };

  const upsertBinding = async (req: AuthenticatedDingTalkRequest, res: Response): Promise<void> => {
    let createdApiKey: { id: string; key: string } | null = null;
    let bindingSaved = false;
    try {
      const agent = await requireAgentOwner(req, res, deps.getAgent);
      if (!agent || !req.user?.id) {
        return;
      }

      const parsed = upsertBindingSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }

      const existing = await deps.getDingTalkBindingByAgent(agent.id);
      if (!existing && !parsed.data.clientSecret) {
        res.status(400).json({ error: 'Client Secret is required for a new binding' });
        return;
      }

      if (!existing) {
        createdApiKey = await deps.createAgentApiKey({
          userId: req.user.id,
          name: `DingTalk · ${agent.name ?? agent.id}`.slice(0, 100),
        });
      }

      const binding = await deps.upsertDingTalkBinding({
        agentId: agent.id,
        ownerUserId: req.user.id,
        clientId: parsed.data.clientId,
        clientSecret: parsed.data.clientSecret,
        robotCode: parsed.data.robotCode,
        apiKeyId: createdApiKey?.id,
        apiKey: createdApiKey?.key,
        enabled: parsed.data.enabled,
      });
      bindingSaved = true;

      try {
        await deps.runtime.refreshBinding(binding._id.toString());
      } catch (error) {
        logger.warn('[DingTalk] Binding saved but Stream connection failed', {
          bindingId: binding._id.toString(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
      const refreshed = await deps.getDingTalkBindingByAgent(agent.id);
      res.status(existing ? 200 : 201).json({ binding: toSummary(refreshed ?? binding) });
    } catch (error) {
      if (createdApiKey && req.user?.id && !bindingSaved) {
        await deps.deleteAgentApiKey(createdApiKey.id, req.user.id).catch(() => undefined);
      }
      logger.error('[DingTalk] Failed to save binding', error);
      res.status(500).json({ error: 'Failed to save DingTalk binding' });
    }
  };

  const deleteBinding = async (req: AuthenticatedDingTalkRequest, res: Response): Promise<void> => {
    try {
      const agent = await requireAgentOwner(req, res, deps.getAgent);
      if (!agent || !req.user?.id) {
        return;
      }

      const binding = await deps.getDingTalkBindingByAgent(agent.id);
      if (!binding) {
        res.status(204).send();
        return;
      }

      await deps.runtime.disconnectBinding(binding._id.toString());
      await deps.deleteAgentApiKey(binding.apiKeyId, req.user.id);
      await deps.deleteDingTalkBinding(agent.id);
      res.status(204).send();
    } catch (error) {
      logger.error('[DingTalk] Failed to delete binding', error);
      res.status(500).json({ error: 'Failed to delete DingTalk binding' });
    }
  };

  const checkInternalBindingAccess = async (
    req: AuthenticatedDingTalkRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const apiKeyId = req.apiKeyId?.toString();
      const model = typeof req.body?.model === 'string' ? req.body.model : '';
      if (!apiKeyId || !model || !req.user?.id) {
        res.status(403).json({ error: 'Invalid DingTalk integration request' });
        return;
      }

      const binding = await deps.getDingTalkBindingByApiKeyId(apiKeyId);
      if (
        !binding ||
        !binding.enabled ||
        binding.agentId !== model ||
        binding.ownerUserId !== req.user.id
      ) {
        res.status(403).json({ error: 'DingTalk binding access denied' });
        return;
      }
      next();
    } catch (error) {
      logger.error('[DingTalk] Failed to authorize internal response request', error);
      res.status(500).json({ error: 'Failed to authorize DingTalk integration request' });
    }
  };

  return {
    getBinding,
    upsertBinding,
    deleteBinding,
    checkInternalBindingAccess,
  };
}
