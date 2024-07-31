import { createApp } from './app';

const mockService = {
  createRoom: vi.fn(),
};

const app = createApp(mockService);

describe('Room Creation API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully creates a room and establishes a WebSocket connection', async () => {
    const mockWebSocket = new WebSocket('ws://example.com');
    mockService.createRoom.mockResolvedValue(mockWebSocket);

    const response = await app.request('http://localhost/rooms/testRoom?uid=testUser', {
      headers: {
        Upgrade: 'websocket',
      },
    });

    expect(response.status).toBe(101);
    expect(response.webSocket).toBe(mockWebSocket);
    expect(mockService.createRoom).toHaveBeenCalledWith('testRoom', 'testUser');
  });

  it('returns 400 when uid query parameter is missing', async () => {
    const response = await app.request('http://localhost/rooms/testRoom', {
      headers: {
        Upgrade: 'websocket',
      },
    });

    expect(response.status).toBe(400);
  });

  it('returns 400 when uid query parameter is invalid', async () => {
    const response = await app.request('http://localhost/rooms/testRoom?uid=', {
      headers: {
        Upgrade: 'websocket',
      },
    });

    expect(response.status).toBe(400);
  });

  it('handles service error correctly', async () => {
    mockService.createRoom.mockRejectedValue(new Error('Service Error'));
    const response = await app.request('http://localhost/rooms/testRoom?uid=testUser', {
      headers: {
        Upgrade: 'websocket',
      },
    });

    expect(response.status).toBe(500);
  });

  it('returns 426 when Upgrade header is not websocket', async () => {
    const response = await app.request('http://localhost/rooms/testRoom?uid=testUser');

    expect(response.status).toBe(426);
    expect(await response.text()).toBe('Expected websocket');
  });
});
