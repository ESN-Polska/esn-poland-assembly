import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { IDEATranslationsModule } from '@idea-ionic/common';

import { TopicsLeaderboardRoutingModule } from './leaderboard.routing.module';
import { TopicsLeaderboardPage } from './leaderboard.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, IDEATranslationsModule, TopicsLeaderboardRoutingModule],
  declarations: [TopicsLeaderboardPage]
})
export class TopicsLeaderboardModule {}
