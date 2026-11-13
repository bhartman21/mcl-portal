import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ShellFooterComponent } from './shared/components/shell-footer.component';
import { ShellHeaderComponent } from './shared/components/shell-header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ShellHeaderComponent, ShellFooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
