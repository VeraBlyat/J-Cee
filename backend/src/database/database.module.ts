import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

// Global para que cualquier módulo pueda inyectar DatabaseService sin importarlo.
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
