const { createDingTalkRuntime } = require('@librechat/api');
const db = require('~/models');

const port = Number.isFinite(Number(process.env.PORT)) ? Number(process.env.PORT) : 3080;
const internalApiUrl = process.env.DINGTALK_INTERNAL_API_URL || `http://127.0.0.1:${port}`;

const dingTalkRuntime = createDingTalkRuntime({
  getDingTalkRuntimeBinding: db.getDingTalkRuntimeBinding,
  listEnabledDingTalkRuntimeBindings: db.listEnabledDingTalkRuntimeBindings,
  setDingTalkBindingStatus: db.setDingTalkBindingStatus,
  getOrCreateDingTalkConversation: db.getOrCreateDingTalkConversation,
  claimDingTalkMessage: db.claimDingTalkMessage,
  finishDingTalkMessage: db.finishDingTalkMessage,
  saveConvo: db.saveConvo,
  internalApiUrl,
});

module.exports = dingTalkRuntime;
