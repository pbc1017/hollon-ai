import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { Conversation } from './entities/conversation.entity';
import { ConversationHistory } from './entities/conversation-history.entity';
import { Hollon } from '../hollon/entities/hollon.entity';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { MessageListener } from './listeners/message.listener';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { TaskModule } from '../task/task.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Message,
      Conversation,
      ConversationHistory,
      Hollon,
    ]),
    forwardRef(() => CollaborationModule),
    TaskModule,
  ],
  controllers: [MessageController],
  providers: [MessageService, MessageListener],
  exports: [MessageService],
})
export class MessageModule {}
