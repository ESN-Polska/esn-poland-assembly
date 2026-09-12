import { Component } from '@angular/core';
import { IonInfiniteScroll } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';

import { AppService } from '@app/app.service';
import { TopicCategoryService } from './categories.service';

import { TopicCategory } from '@models/category.model';

@Component({
  selector: 'categories',
  templateUrl: 'categories.page.html',
  styleUrls: ['categories.page.scss']
})
export class CategoriesPage {
  categories: TopicCategory[];

  isArchiveView(): boolean {
    return this.route.snapshot.data.archived === true;
  }

  constructor(
    private route: ActivatedRoute,
    private _categories: TopicCategoryService,
    public app: AppService
  ) {}
  async ionViewDidEnter(): Promise<void> {
    const showArchived = this.isArchiveView();
    this.categories = await this._categories.getList({ force: true, archivedOnly: showArchived, withPagination: true });
  }

  async paginate(scrollToNextPage?: IonInfiniteScroll): Promise<void> {
    let startPaginationAfterId = null;
    if (scrollToNextPage && this.categories?.length)
      startPaginationAfterId = this.categories[this.categories.length - 1].categoryId;

    this.categories = await this._categories.getList({
      archivedOnly: this.isArchiveView(),
      withPagination: true,
      startPaginationAfterId
    });

    if (scrollToNextPage) setTimeout((): Promise<void> => scrollToNextPage.complete(), 100);
  }

  addCategory(): void {
    this.app.goToInTabs(['configurations', 'categories', 'new']);
  }
  openCategory(category: TopicCategory): void {
    this.app.goToInTabs(['configurations', 'categories', category.categoryId]);
  }
}
