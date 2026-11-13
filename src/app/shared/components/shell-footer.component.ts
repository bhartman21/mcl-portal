import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-shell-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './shell-footer.component.html',
  styleUrl: './shell-footer.component.scss',
})
export class ShellFooterComponent {
  readonly ribbonRackUrl = environment.ribbonRackBuilderUrl;
}
