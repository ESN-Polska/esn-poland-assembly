import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { IDEAShowHintButtonModule, IDEATranslationsModule } from '@idea-ionic/common';

import { ConfigurationsRoutingModule } from './configurations.routing.module';
import { ConfigurationsPage } from './configurations.page';

import { EmailTemplateModule } from './emailTemplate/emailTemplate.module';
import { GiveBadgesComponent } from './badges/giveBadges.component';
import { ManageBadgesComponent } from './badges/manageBadges.component';
import { UserRoleMappingsComponent } from './userRoleMappings.component';
import { RoleEditorComponent } from './roleEditor.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    IDEATranslationsModule,
    IDEAShowHintButtonModule,
    ConfigurationsRoutingModule,
    EmailTemplateModule,
    GiveBadgesComponent,
    ManageBadgesComponent,
    UserRoleMappingsComponent,
    RoleEditorComponent
  ],
  declarations: [ConfigurationsPage]
})
export class ConfigurationsModule {}
