import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { dataUrlToBlob, PendingAdImage } from '../../core/ad-book/ad-image-storage';
import { AdItem, AdSize, SEED_AD_SIZES } from '../../core/models/ad-book.model';
import { AdBookService } from '../../core/services/ad-book.service';
import { DocumentConverterService } from '../../core/services/document-converter.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read the file.'));
    reader.readAsDataURL(file);
  });
}

@Component({
  selector: 'app-ad-editor',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './ad-editor.component.html',
  styleUrl: './ad-editor.component.scss',
})
export class AdEditorComponent implements OnInit {
  readonly adBook = inject(AdBookService);
  private readonly converter = inject(DocumentConverterService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly adId = signal<string | null>(null);
  readonly existingAd = computed<AdItem | undefined>(() =>
    this.adId() ? this.adBook.getAdById(this.adId()!) : undefined
  );
  readonly isNew = computed(() => !this.adId());
  /**
   * Read-only while submitted or approved, and while the ad is locked after its last allowed
   * submission (AD_BOOK.md "Submission limit": only an admin reset unlocks it, #32).
   */
  readonly isLockedForEdit = computed(() => {
    const ad = this.existingAd();
    return ad?.status === 'submitted' || ad?.status === 'approved' || !!ad?.locked;
  });

  title = '';
  companyName = '';
  sizeId = 'full';

  readonly imageUrl = signal<string | undefined>(undefined);
  readonly imageName = signal<string | undefined>(undefined);
  readonly fit = signal<'cover' | 'contain'>('cover');
  readonly posX = signal<number>(50);
  readonly posY = signal<number>(50);

  /**
   * Artwork chosen in this session and not saved yet. It is uploaded to Firebase Storage on save
   * (issue #4); the preview is a local data URL only.
   */
  private pendingImage: PendingAdImage | null = null;
  readonly saving = signal(false);
  /** Save as PNG/PDF works on freshly loaded artwork (a local data URL). */
  readonly canExport = computed(() => !!this.imageUrl()?.startsWith('data:'));

  readonly converting = signal(false);
  readonly pdfPageCount = signal(0);
  readonly pdfCurrentPage = signal(1);
  private lastPdfFile: File | null = null;

  readonly notice = signal<string | null>(null);
  readonly errorMsg = signal<string | null>(null);

  readonly selectedSize = computed<AdSize>(() => {
    const found = this.adBook.getSizeById(this.sizeId);
    // Sizes load from Firestore; show the first seed size until they arrive.
    return found ?? this.adBook.activeSizes()[0] ?? SEED_AD_SIZES[0];
  });

  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private startPosX = 50;
  private startPosY = 50;

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('adId');
    if (idParam) {
      const ad = this.adBook.getAdById(idParam);
      if (ad) {
        this.loadAd(ad);
      } else {
        // With Firebase the ads may still be loading (direct link or page refresh).
        void this.adBook.whenAdsLoaded().then(() => {
          const loaded = this.adBook.getAdById(idParam);
          if (loaded) this.loadAd(loaded);
          else this.errorMsg.set('Ad not found.');
        });
      }
    } else {
      const firstActive = this.adBook.activeSizes()[0];
      if (firstActive) {
        this.sizeId = firstActive.id;
      }
    }
  }

  private loadAd(ad: AdItem): void {
    this.adId.set(ad.id);
    this.title = ad.title;
    this.companyName = ad.companyName ?? '';
    this.sizeId = ad.sizeId;
    this.imageName.set(ad.imageName);
    this.fit.set(ad.fit);
    this.posX.set(ad.position.x);
    this.posY.set(ad.position.y);
  }

  /** Saved image: the editor follows the ad (Storage URLs resolve after the ad loads). */
  readonly displayUrl = computed(() => this.imageUrl() ?? this.existingAd()?.imageUrl);

  private setPending(blob: Blob, name: string, previewUrl: string): void {
    this.pendingImage = { blob, name, previewUrl };
    this.imageUrl.set(previewUrl);
    this.imageName.set(name);
  }

  async onFileSelected(event: Event): Promise<void> {
    this.errorMsg.set(null);
    this.notice.set(null);
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      this.errorMsg.set('File exceeds the 10 MB limit. Please choose a smaller file.');
      return;
    }

    const lowerName = file.name.toLowerCase();
    const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
    const isDocx =
      file.type ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      lowerName.endsWith('.docx');
    const isLegacyDoc = lowerName.endsWith('.doc') && !isDocx;

    if (isLegacyDoc) {
      this.errorMsg.set(
        'Legacy .doc files cannot be converted in the browser. Please save as .docx or .pdf in Word and upload again.'
      );
      return;
    }

    if (!isImage && !isPdf && !isDocx) {
      this.errorMsg.set('Please select a JPEG, PNG, WebP, PDF, or Word (.docx) file.');
      return;
    }

    this.pdfPageCount.set(0);
    this.pdfCurrentPage.set(1);
    this.lastPdfFile = null;

    if (isImage) {
      try {
        this.setPending(file, file.name, await readAsDataUrl(file));
      } catch (err) {
        this.errorMsg.set(err instanceof Error ? err.message : 'Unable to read the file.');
      }
      return;
    }

    this.converting.set(true);
    try {
      if (isPdf) {
        this.lastPdfFile = file;
        const result = await this.converter.convertPdfToPng(file, 1);
        this.setPending(dataUrlToBlob(result.pngDataUrl), file.name, result.pngDataUrl);
        this.pdfPageCount.set(result.pageCount);
        this.fit.set('contain');
        this.notice.set(
          `Converted PDF (${result.pageCount} page${result.pageCount > 1 ? 's' : ''}) to PNG for ad framing. You can also download as PNG or PDF below.`
        );
      } else if (isDocx) {
        const pngDataUrl = await this.converter.convertDocxToPng(file);
        this.setPending(dataUrlToBlob(pngDataUrl), file.name, pngDataUrl);
        this.fit.set('contain');
        this.notice.set(
          'Converted Word (.docx) document to PNG for ad framing. You can also download as PNG or PDF below.'
        );
      }
    } catch (err) {
      this.errorMsg.set(
        err instanceof Error
          ? `Conversion failed: ${err.message}`
          : 'Unable to convert document.'
      );
    } finally {
      this.converting.set(false);
    }
  }

  async changePdfPage(pageNum: number): Promise<void> {
    if (!this.lastPdfFile) return;
    this.converting.set(true);
    try {
      const result = await this.converter.convertPdfToPng(this.lastPdfFile, pageNum);
      this.pdfCurrentPage.set(pageNum);
      this.setPending(dataUrlToBlob(result.pngDataUrl), this.lastPdfFile.name, result.pngDataUrl);
    } catch (err) {
      this.errorMsg.set(
        err instanceof Error ? err.message : 'Unable to render PDF page.'
      );
    } finally {
      this.converting.set(false);
    }
  }

  saveAsPng(): void {
    const url = this.imageUrl();
    if (!url) return;
    this.converter.downloadPng(url, this.title || this.imageName() || 'mcl-ad');
  }

  saveAsPdf(): void {
    const url = this.imageUrl();
    if (!url) return;
    const size = this.selectedSize();
    this.converter.downloadPdfFromPng(
      url,
      this.title || this.imageName() || 'mcl-ad',
      size.widthIn,
      size.heightIn
    );
  }

  onDragStart(event: PointerEvent): void {
    if (this.fit() !== 'cover' || !this.displayUrl() || this.isLockedForEdit()) return;
    this.dragging = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.startPosX = this.posX();
    this.startPosY = this.posY();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  onDragMove(event: PointerEvent): void {
    if (!this.dragging) return;
    const dx = event.clientX - this.dragStartX;
    const dy = event.clientY - this.dragStartY;
    this.posX.set(Math.max(0, Math.min(100, Math.round(this.startPosX - dx * 0.25))));
    this.posY.set(Math.max(0, Math.min(100, Math.round(this.startPosY - dy * 0.25))));
  }

  onDragEnd(): void {
    this.dragging = false;
  }

  async saveDraft(): Promise<AdItem | null> {
    this.errorMsg.set(null);
    this.notice.set(null);

    if (!this.title.trim()) {
      this.errorMsg.set('Please enter an ad title.');
      return null;
    }

    this.saving.set(true);
    try {
      const payload = {
        title: this.title,
        companyName: this.companyName,
        sizeId: this.sizeId,
        fit: this.fit(),
        position: { x: this.posX(), y: this.posY() },
        ...(this.pendingImage ? { image: this.pendingImage } : {}),
      };

      let saved: AdItem;
      if (this.adId()) {
        saved = await this.adBook.updateAd(this.adId()!, payload);
      } else {
        saved = await this.adBook.createAd(payload);
        this.adId.set(saved.id);
      }
      this.pendingImage = null;
      this.notice.set('Draft saved.');
      return saved;
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Unable to save draft.');
      return null;
    } finally {
      this.saving.set(false);
    }
  }

  async saveAndSubmit(): Promise<void> {
    const saved = await this.saveDraft();
    if (!saved) return;
    try {
      await this.adBook.submitAd(saved.id);
      await this.router.navigate(['/ad-book']);
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Unable to submit ad.');
    }
  }

  async recall(): Promise<void> {
    if (!this.adId()) return;
    try {
      await this.adBook.recallToDraft(this.adId()!);
      this.notice.set('Ad withdrawn to draft. You may now edit and resubmit.');
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Unable to withdraw ad.');
    }
  }
}
