import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { AppService } from '@app/app.service';

@Component({
  selector: 'profile',
  templateUrl: 'profile.page.html',
  styleUrls: ['profile.page.scss']
})
export class ProfilePage implements OnInit {
  target: string;

  private route = inject(ActivatedRoute);
  _app = inject(AppService);

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.target = params.userId ?? null;
    });
  }
}
