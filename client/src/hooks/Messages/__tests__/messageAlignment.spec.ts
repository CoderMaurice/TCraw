import { getMessageTurnLayoutClasses } from '../messageAlignment';

describe('message turn alignment', () => {
  it('aligns user turns to the right and keeps their avatar after the content', () => {
    expect(
      getMessageTurnLayoutClasses({ isCreatedByUser: true, hasParallelContent: false }),
    ).toEqual({
      row: 'justify-end',
      avatar: 'order-2',
      body: 'order-1 items-end w-fit max-w-[85%] md:max-w-[47rem] xl:max-w-[55rem]',
      content: 'items-end',
      actions: 'justify-end',
    });
  });

  it('aligns agent turns to the left and keeps their avatar before the content', () => {
    expect(
      getMessageTurnLayoutClasses({ isCreatedByUser: false, hasParallelContent: false }),
    ).toEqual({
      row: 'justify-start',
      avatar: 'order-1',
      body: 'order-2 items-start w-11/12',
      content: 'items-start',
      actions: 'justify-start',
    });
  });

  it('keeps parallel content full width to avoid narrowing complex responses', () => {
    expect(
      getMessageTurnLayoutClasses({ isCreatedByUser: true, hasParallelContent: true }),
    ).toEqual({
      row: 'justify-end',
      avatar: 'order-2',
      body: 'order-1 items-end w-full',
      content: 'items-end',
      actions: 'justify-end',
    });
  });
});
