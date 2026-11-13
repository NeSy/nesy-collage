import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../i18n';
import { LayoutService } from '../layout/layout';
import { Workspace } from '../workspace';

@Component({
  selector: 'app-page-navigation',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [TranslatePipe],
  templateUrl: './page-navigation.html',
  styleUrl: './page-navigation.scss',
})
export class PageNavigation {
  constructor(
    public layout: LayoutService,
    public workspace: Workspace,
  ) {}

  addPage(): void {
    this.layout.addPage();
    this.workspace.showPanel('canvas');
  }
}
