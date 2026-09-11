import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { IDEATranslationsModule } from '@idea-ionic/common';

import { CreditsRoutingModule } from './credits.routing.module';
import { CreditsPage } from './credits.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, IDEATranslationsModule, CreditsRoutingModule],
  declarations: [CreditsPage]
})
export class CreditsModule {}