import { Injectable } from '@angular/core';
import {
  FormGroup, FormControl, Validators, FormArray, AbstractControl,
} from '@angular/forms';
import { UntilDestroy } from '@ngneat/until-destroy';
import { of, Subscription } from 'rxjs';
import { ChartSchemaType } from 'app/enums/chart-schema-type.enum';
import { DynamicFormSchemaType } from 'app/enums/dynamic-form-schema-type.enum';
import { ChartFormValue, ChartSchemaNode } from 'app/interfaces/chart-release.interface';
import { AddListItemEvent, DeleteListItemEvent, DynamicFormSchemaNode } from 'app/interfaces/dynamic-form-schema.interface';
import { HierarchicalObjectMap } from 'app/interfaces/hierarhical-object-map.interface';
import { Relation } from 'app/modules/entity/entity-form/models/field-relation.interface';
import { FilesystemService } from 'app/services/filesystem.service';

@UntilDestroy()
@Injectable({
  providedIn: 'root',
})
export class AppSchemaService {
  constructor(
    protected filesystemService: FilesystemService,
  ) {}

  transformNode(chartSchemaNode: ChartSchemaNode): DynamicFormSchemaNode[] {
    const schema = chartSchemaNode.schema;
    let newSchema: DynamicFormSchemaNode[] = [];
    if (schema.hidden) {
      return;
    }

    if ([
      ChartSchemaType.Int,
      ChartSchemaType.String,
      ChartSchemaType.Boolean,
      ChartSchemaType.Path,
      ChartSchemaType.Hostpath,
      ChartSchemaType.Ipaddr,
    ].includes(schema.type)) {
      switch (schema.type) {
        case ChartSchemaType.Int:
          if (schema.enum) {
            newSchema.push({
              controlName: chartSchemaNode.variable,
              type: DynamicFormSchemaType.Select,
              title: chartSchemaNode.label,
              options: of(schema.enum.map((option) => ({
                value: option.value,
                label: option.description,
              }))),
              required: true,
              editable: schema.editable,
              tooltip: chartSchemaNode.description,
            });
          } else {
            newSchema.push({
              controlName: chartSchemaNode.variable,
              type: DynamicFormSchemaType.Input,
              title: chartSchemaNode.label,
              required: schema.required,
              tooltip: chartSchemaNode.description,
              editable: schema.editable,
              private: schema.private,
              number: true,
            });
          }
          break;
        case ChartSchemaType.String:
          if (schema.enum) {
            newSchema.push({
              controlName: chartSchemaNode.variable,
              type: DynamicFormSchemaType.Select,
              title: chartSchemaNode.label,
              options: of(schema.enum.map((option) => ({
                value: option.value,
                label: option.description,
              }))),
              required: true,
              editable: schema.editable,
              tooltip: chartSchemaNode.description,
            });
          } else {
            newSchema.push({
              controlName: chartSchemaNode.variable,
              type: DynamicFormSchemaType.Input,
              title: chartSchemaNode.label,
              required: schema.required,
              editable: schema.editable,
              tooltip: chartSchemaNode.description,
              private: schema.private,
            });
          }
          break;
        case ChartSchemaType.Path:
          newSchema.push({
            controlName: chartSchemaNode.variable,
            type: DynamicFormSchemaType.Input,
            title: chartSchemaNode.label,
            required: schema.required,
            editable: schema.editable,
            tooltip: chartSchemaNode.description,
          });
          break;
        case ChartSchemaType.Hostpath:
          newSchema.push({
            controlName: chartSchemaNode.variable,
            type: DynamicFormSchemaType.Explorer,
            title: chartSchemaNode.label,
            nodeProvider: this.filesystemService.getFilesystemNodeProvider(),
            required: schema.required,
            editable: schema.editable,
            tooltip: chartSchemaNode.description,
          });
          break;
        case ChartSchemaType.Boolean:
          newSchema.push({
            controlName: chartSchemaNode.variable,
            type: DynamicFormSchemaType.Checkbox,
            title: chartSchemaNode.label,
            required: schema.required,
            editable: schema.editable,
            tooltip: chartSchemaNode.description,
          });
          break;
        case ChartSchemaType.Ipaddr:
          if (schema.cidr) {
            newSchema.push({
              controlName: chartSchemaNode.variable,
              type: DynamicFormSchemaType.Ipaddr,
              title: chartSchemaNode.label,
              required: schema.required,
              editable: schema.editable,
              tooltip: chartSchemaNode.description,
            });
          } else {
            newSchema.push({
              controlName: chartSchemaNode.variable,
              type: DynamicFormSchemaType.Input,
              title: chartSchemaNode.label,
              required: schema.required,
              tooltip: chartSchemaNode.description,
              editable: schema.editable,
              private: schema.private,
            });
          }
          break;
      }
      if (schema.subquestions) {
        schema.subquestions.forEach((subquestion) => {
          const objs = this.transformNode(subquestion);
          objs.forEach((obj) => {
            obj.indent = true;
            obj.dependsOn = [chartSchemaNode.variable];
          });
          newSchema = newSchema.concat(objs);
        });
      }
    } else if (schema.type === ChartSchemaType.Dict) {
      let attrs: DynamicFormSchemaNode[] = [];
      schema.attrs.forEach((attr) => {
        attrs = attrs.concat(this.transformNode(attr));
      });
      newSchema.push({
        controlName: chartSchemaNode.variable,
        type: DynamicFormSchemaType.Dict,
        title: chartSchemaNode.label,
        attrs,
        editable: schema.editable,
      });
    } else if (schema.type === ChartSchemaType.List) {
      let items: DynamicFormSchemaNode[] = [];
      let itemsSchema: ChartSchemaNode[] = [];
      schema.items.forEach((item) => {
        if (item.schema.attrs) {
          item.schema.attrs.forEach((attr) => {
            items = items.concat(this.transformNode(attr));
            itemsSchema = itemsSchema.concat(attr);
          });
        } else {
          items = items.concat(this.transformNode(item));
          itemsSchema = itemsSchema.concat(item);
        }
      });
      newSchema.push({
        controlName: chartSchemaNode.variable,
        type: DynamicFormSchemaType.List,
        title: chartSchemaNode.label,
        items,
        itemsSchema,
        editable: schema.editable,
        dependsOn: schema.show_if?.map((conditional) => conditional[0]),
      });
    } else {
      console.error('Unsupported type = ', schema.type);
    }
    return newSchema;
  }

  addFormControls(
    chartSchemaNode: ChartSchemaNode,
    formGroup: FormGroup,
    config: HierarchicalObjectMap<ChartFormValue>,
  ): Subscription {
    const subscription = new Subscription();
    const schema = chartSchemaNode.schema;
    if (schema.hidden) {
      return;
    }

    if ([
      ChartSchemaType.Int,
      ChartSchemaType.String,
      ChartSchemaType.Boolean,
      ChartSchemaType.Path,
      ChartSchemaType.Hostpath,
      ChartSchemaType.Ipaddr,
    ].includes(schema.type)) {
      const newFormControl = new FormControl(schema.default, [
        schema.required ? Validators.required : Validators.nullValidator,
        schema.max ? Validators.max(schema.max) : Validators.nullValidator,
        schema.min ? Validators.min(schema.min) : Validators.nullValidator,
        schema.max_length ? Validators.maxLength(schema.max_length) : Validators.nullValidator,
        schema.min_length ? Validators.minLength(schema.min_length) : Validators.nullValidator,
      ]);

      if (schema.subquestions) {
        schema.subquestions.forEach((subquestion) => {
          subscription.add(this.addFormControls(subquestion, formGroup, config));
          if (subquestion.schema.default === schema.show_subquestions_if) {
            formGroup.controls[subquestion.variable].enable();
          } else {
            formGroup.controls[subquestion.variable].disable();
          }
        });
        subscription.add(newFormControl.valueChanges
          .subscribe((value) => {
            schema.subquestions.forEach((subquestion) => {
              if (formGroup.controls[subquestion.variable].parent.enabled) {
                if (value === schema.show_subquestions_if) {
                  formGroup.controls[subquestion.variable].enable();
                } else {
                  formGroup.controls[subquestion.variable].disable();
                }
              }
            });
          }));
      }

      formGroup.addControl(chartSchemaNode.variable, newFormControl);

      if (schema.default !== undefined) {
        formGroup.controls[chartSchemaNode.variable].setValue(schema.default);
      }
    } else if (schema.type === ChartSchemaType.Dict) {
      formGroup.addControl(chartSchemaNode.variable, new FormGroup({}));
      for (const attr of schema.attrs) {
        subscription.add(this.addFormControls(attr, formGroup.controls[chartSchemaNode.variable] as FormGroup, config));
      }
    } else if (schema.type === ChartSchemaType.List) {
      formGroup.addControl(chartSchemaNode.variable, new FormArray([]));

      if (config) {
        let items: ChartSchemaNode[] = [];
        chartSchemaNode.schema.items.forEach((item) => {
          if (item.schema.attrs) {
            item.schema.attrs.forEach((attr) => {
              items = items.concat(attr);
            });
          } else {
            items = items.concat(item);
          }
        });

        const configControlPath = this.getControlPath(formGroup.controls[chartSchemaNode.variable], '').split('.');
        let nextItem = config;
        for (const path of configControlPath) {
          if (nextItem) {
            nextItem = nextItem[path] as HierarchicalObjectMap<ChartFormValue>;
          }
        }

        if (Array.isArray(nextItem)) {
          for (const item of nextItem) {
            subscription.add(this.addFormListItem({
              array: formGroup.controls[chartSchemaNode.variable] as FormArray,
              schema: items,
            }, item));
          }
        }
      }
    }

    if (schema.show_if) {
      const relations: Relation[] = schema.show_if.map((item) => ({
        fieldName: item[0],
        operatorName: item[1],
        operatorValue: item[2],
      }));
      relations.forEach((relation) => {
        if (!formGroup.controls[relation.fieldName]) {
          formGroup.addControl(relation.fieldName, new FormControl());
          formGroup.controls[relation.fieldName].disable();
        }
        switch (relation.operatorName) {
          case '=':
            if (formGroup.controls[relation.fieldName].value !== relation.operatorValue) {
              formGroup.controls[chartSchemaNode.variable].disable();
            }
            subscription.add(formGroup.controls[relation.fieldName].valueChanges
              .subscribe((value) => {
                if (value !== null && formGroup.controls[chartSchemaNode.variable].parent.enabled) {
                  if (value === relation.operatorValue) {
                    formGroup.controls[chartSchemaNode.variable].enable();
                  } else {
                    formGroup.controls[chartSchemaNode.variable].disable();
                  }
                }
              }));
            break;
          case '!=':
            if (formGroup.controls[relation.fieldName].value === relation.operatorValue) {
              formGroup.controls[chartSchemaNode.variable].disable();
            }
            subscription.add(formGroup.controls[relation.fieldName].valueChanges
              .subscribe((value) => {
                if (value !== null && formGroup.controls[chartSchemaNode.variable].parent.enabled) {
                  if (value !== relation.operatorValue) {
                    formGroup.controls[chartSchemaNode.variable].enable();
                  } else {
                    formGroup.controls[chartSchemaNode.variable].disable();
                  }
                }
              }));
            break;
        }
      });
    }

    return subscription;
  }

  getControlName(control: AbstractControl): string | null {
    if (control.parent == null) {
      return null;
    }
    const children = control.parent.controls;

    if (Array.isArray(children)) {
      for (let index = 0; index < children.length; index++) {
        if (children[index] === control) {
          return `${index}`;
        }
      }
      return null;
    }
    return Object.keys(children).find((name) => control === children[name]) || null;
  }

  getControlPath(control: AbstractControl, path: string): string | null {
    path = this.getControlName(control) + path;

    if (control.parent && this.getControlName(control.parent)) {
      path = '.' + path;
      return this.getControlPath(control.parent, path);
    }
    return path;
  }

  addFormListItem(event: AddListItemEvent, config?: HierarchicalObjectMap<ChartFormValue>): Subscription {
    const subscriptionEvent = new Subscription();
    const itemFormGroup = new FormGroup({});
    event.schema.forEach((item) => {
      subscriptionEvent.add(this.addFormControls(item as ChartSchemaNode, itemFormGroup, config));
    });
    event.array.push(itemFormGroup);

    return subscriptionEvent;
  }

  deleteFormListItem(event: DeleteListItemEvent): void {
    event.array.removeAt(event.index);
  }

  remapAppSubmitData(data: HierarchicalObjectMap<ChartFormValue>): HierarchicalObjectMap<ChartFormValue> {
    let result: any;
    if (data === undefined || data === null) {
      result = data;
    } else if (Array.isArray(data)) {
      result = data.map((item) => {
        if (Object.keys(item).length > 1) {
          return this.remapAppSubmitData(item);
        }
        return this.remapAppSubmitData(item[Object.keys(item)[0]]);
      });
    } else if (typeof data === 'object') {
      result = {};
      Object.keys(data).forEach((key) => {
        result[key] = this.remapAppSubmitData(data[key] as HierarchicalObjectMap<ChartFormValue>);
      });
    } else if (typeof data === 'string' && !Number.isNaN(Number(data))) {
      result = Number(data);
    } else {
      result = data;
    }
    return result;
  }
}