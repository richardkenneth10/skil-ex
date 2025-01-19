import { Test, TestingModule } from '@nestjs/testing';
import { WebRTCGateway } from './web-rtc.gateway';

describe('WebRTCGateway', () => {
  let gateway: WebRTCGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebRTCGateway],
    }).compile();

    gateway = module.get<WebRTCGateway>(WebRTCGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
