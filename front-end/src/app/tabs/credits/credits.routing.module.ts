import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CreditsPage } from './credits.page';

const routes: Routes = [{ path: '', component: CreditsPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CreditsRoutingModule {}