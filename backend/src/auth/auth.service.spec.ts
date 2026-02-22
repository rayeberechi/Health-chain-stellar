import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import Redis from 'ioredis';
import { AuthService } from './auth.service';
import { REDIS_CLIENT } from '../redis/redis.constants';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let redis: Redis;

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        JWT_SECRET: 'test-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_EXPIRES_IN: '1h',
        JWT_REFRESH_EXPIRES_IN: '7d',
      };
      return config[key] || defaultValue;
    }),
  };

  const mockRedis = {
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    redis = module.get<Redis>(REDIS_CLIENT);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should return access and refresh tokens', async () => {
      mockJwtService.sign.mockReturnValueOnce('access-token');
      mockJwtService.sign.mockReturnValueOnce('refresh-token');

      const result = await service.login({
        email: 'test@example.com',
        password: 'password',
        role: 'donor',
      });

      expect(result).toEqual({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      });
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens when refresh token is valid and unused', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'donor',
      };

      mockJwtService.verify.mockReturnValue(mockPayload);
      mockRedis.set.mockResolvedValue('OK'); // SET NX succeeds
      mockJwtService.sign.mockReturnValueOnce('new-access-token');
      mockJwtService.sign.mockReturnValueOnce('new-refresh-token');

      const result = await service.refreshToken('old-refresh-token');

      expect(result).toEqual({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      });
      expect(mockRedis.set).toHaveBeenCalledWith(
        'refresh_token:old-refresh-token',
        '1',
        'EX',
        604800,
        'NX',
      );
    });

    it('should throw UnauthorizedException when token is already used', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'donor',
      };

      mockJwtService.verify.mockReturnValue(mockPayload);
      mockRedis.set.mockResolvedValue(null); // SET NX fails (key exists)

      await expect(service.refreshToken('used-refresh-token')).rejects.toThrow(
        new UnauthorizedException('INVALID_REFRESH_TOKEN'),
      );
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token is expired', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Token expired');
      });

      await expect(service.refreshToken('expired-token')).rejects.toThrow(
        'Invalid or expired refresh token',
      );
    });
  });
});
