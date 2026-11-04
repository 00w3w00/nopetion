import { ServiceUnavailableException } from '@nestjs/common';
import type { AiProfile } from './ai-credentials.store';
import {
  OpenAiOAuthProvider,
  readResponseStream,
} from './openai-oauth.provider';

const encoder = new TextEncoder();
const events = (...items: object[]) =>
  encoder.encode(
    items.map((item) => `data: ${JSON.stringify(item)}\n\n`).join(''),
  );

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected promise to reject');
}

describe('OpenAI response stream boundaries', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns a completed result without reading a later transport failure', async () => {
    let pull = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pull++ === 0) {
          controller.enqueue(
            events(
              { type: 'response.output_text.delta', delta: 'complete' },
              { type: 'response.completed' },
            ),
          );
          return;
        }
        controller.error(new Error('socket reset after terminal event'));
      },
    });

    await expect(readResponseStream(new Response(body))).resolves.toBe(
      'complete',
    );
  });

  it('does not let a cancel failure replace a completed result', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          events(
            { type: 'response.output_text.delta', delta: 'complete' },
            { type: 'response.completed' },
          ),
        );
      },
      cancel() {
        throw new Error('cleanup failed');
      },
    });

    await expect(readResponseStream(new Response(body))).resolves.toBe(
      'complete',
    );
  });

  it('preserves the typed incomplete error when an errored reader also rejects cancel', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('socket reset'));
      },
    });

    const error = await rejection(readResponseStream(new Response(body)));

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      code: 'incomplete',
    });
  });

  it('preserves a typed tooLarge error from bounded JSON reads', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('x'.repeat(2_000_001)));
    const profile: AiProfile = {
      id: 'profile',
      clientId: 'oaiapp_test',
      subject: 'subject',
      email: 'test@example.com',
      accessToken: 'token',
      scopes: ['chatgpt.tokens.use.direct'],
    };

    const error = await rejection(new OpenAiOAuthProvider().models(profile));

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      code: 'tooLarge',
    });
  });
});
