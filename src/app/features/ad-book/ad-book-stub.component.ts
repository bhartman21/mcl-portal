import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-ad-book-stub',
  standalone: true,
  imports: [],
  templateUrl: './ad-book-stub.component.html',
})
export class AdBookStubComponent {
  readonly auth = inject(AuthService);
}
