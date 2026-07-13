type MessageTurnLayoutParams = {
  isCreatedByUser: boolean;
  hasParallelContent: boolean;
};

type MessageTurnLayoutClasses = {
  row: string;
  avatar: string;
  body: string;
  header: string;
  content: string;
  timestamp: string;
  actions: string;
};

export function getMessageTurnLayoutClasses({
  isCreatedByUser,
  hasParallelContent,
}: MessageTurnLayoutParams): MessageTurnLayoutClasses {
  const row = isCreatedByUser ? 'justify-end' : 'justify-start';
  const avatar = isCreatedByUser ? 'order-2' : 'order-1';
  const header = isCreatedByUser
    ? 'flex-row-reverse justify-start text-right'
    : 'flex-row justify-start text-left';
  const content = isCreatedByUser ? 'items-end' : 'items-start';
  const timestamp = isCreatedByUser ? 'mr-2' : 'ml-2';
  const actions = isCreatedByUser ? 'justify-end' : 'justify-start';

  if (hasParallelContent) {
    return {
      row,
      avatar,
      body: isCreatedByUser ? 'order-1 items-end w-full' : 'order-2 items-start w-full',
      header,
      content,
      timestamp,
      actions,
    };
  }

  return {
    row,
    avatar,
    body: isCreatedByUser
      ? 'order-1 items-end w-fit max-w-[85%] md:max-w-[47rem] xl:max-w-[55rem]'
      : 'order-2 items-start w-11/12',
    header,
    content,
    timestamp,
    actions,
  };
}
