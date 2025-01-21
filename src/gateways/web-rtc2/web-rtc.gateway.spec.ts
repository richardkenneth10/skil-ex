import { Test, TestingModule } from '@nestjs/testing';
import { WebRTCGateway2 } from './web-rtc.gateway';

describe('WebRTCGateway2', () => {
  let gateway: WebRTCGateway2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebRTCGateway2],
    }).compile();

    gateway = module.get<WebRTCGateway2>(WebRTCGateway2);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
