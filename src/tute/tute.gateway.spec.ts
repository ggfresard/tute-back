import { Test, TestingModule } from '@nestjs/testing';
import { TuteGateway } from './tute.gateway';

describe('TuteGateway', () => {
  let gateway: TuteGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TuteGateway],
    }).compile();

    gateway = module.get<TuteGateway>(TuteGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
