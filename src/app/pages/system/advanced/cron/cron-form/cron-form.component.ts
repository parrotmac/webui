import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
} from '@angular/core';
import { Validators } from '@angular/forms';
import { FormBuilder } from '@ngneat/reactive-forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import helptext from 'app/helptext/system/cron-form';
import { Cronjob } from 'app/interfaces/cronjob.interface';
import { FormErrorHandlerService } from 'app/modules/ix-forms/services/form-error-handler.service';
import { crontabToSchedule, scheduleToCrontab } from 'app/modules/scheduler/utils/schedule-to-crontab.utils';
import { WebSocketService } from 'app/services';
import { IxSlideInService } from 'app/services/ix-slide-in.service';

@UntilDestroy()
@Component({
  templateUrl: './cron-form.component.html',
  styleUrls: ['./cron-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CronFormComponent {
  get isNew(): boolean {
    return !this.editingCron;
  }

  get title(): string {
    return this.isNew
      ? this.translate.instant('Add Cron Job')
      : this.translate.instant('Edit Cron Job');
  }

  form = this.fb.group({
    description: [''],
    command: ['', Validators.required],
    user: ['', Validators.required],
    crontab: ['0 0 * * *', Validators.required],
    stdout: [true],
    stderr: [false],
    enabled: [true],
  });

  readonly tooltips = {
    description: helptext.cron_description_tooltip,
    command: helptext.cron_command_tooltip,
    user: helptext.cron_user_tooltip,
    crontab: helptext.crontab_tooltip,
    stdout: helptext.cron_stdout_tooltip,
    stderr: helptext.cron_stderr_tooltip,
    enabled: helptext.cron_enabled_tooltip,
  };

  isLoading = false;

  private editingCron: Cronjob;

  constructor(
    private fb: FormBuilder,
    private ws: WebSocketService,
    private translate: TranslateService,
    private slideInService: IxSlideInService,
    private errorHandler: FormErrorHandlerService,
    private cdr: ChangeDetectorRef,
  ) {}

  setCronForEdit(cron: Cronjob): void {
    this.editingCron = cron;
    if (!this.isNew) {
      this.form.patchValue({
        ...cron,
        crontab: scheduleToCrontab(cron.schedule),
      });
    }
  }

  onSubmit(): void {
    const values = {
      ...this.form.value,
      schedule: crontabToSchedule(this.form.value.crontab),
    };

    this.isLoading = true;
    let request$: Observable<unknown>;
    if (this.isNew) {
      request$ = this.ws.call('cronjob.create', [values]);
    } else {
      request$ = this.ws.call('cronjob.update', [
        this.editingCron.id,
        values,
      ]);
    }

    request$.pipe(untilDestroyed(this)).subscribe(() => {
      this.isLoading = false;
      this.slideInService.close();
    }, (error) => {
      this.isLoading = false;
      this.errorHandler.handleWsFormError(error, this.form);
      this.cdr.markForCheck();
    });
  }
}
