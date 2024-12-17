import { Test, TestingModule } from '@nestjs/testing';
import { StringsService } from './strings.service';

describe('StringsService', () => {
  let service: StringsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StringsService],
    }).compile();

    service = module.get<StringsService>(StringsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
