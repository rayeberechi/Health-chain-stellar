import { Controller, Get } from '@nestjs/common';

@Controller('i18n')
export class I18nController {
  @Get('supported-languages')
  getSupportedLanguages() {
    return ['en', 'fr', 'es', 'ar'];
  }
}
