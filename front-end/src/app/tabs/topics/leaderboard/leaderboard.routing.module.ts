import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TopicsLeaderboardPage } from './leaderboard.page';

const routes: Routes = [
  {
    path: '',
    component: TopicsLeaderboardPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TopicsLeaderboardRoutingModule {}
