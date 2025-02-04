export interface Dialog {
  callback_id: string;
  title: string;
  introduction_text?: string;
  elements: DialogElement[];
  submit_label?: string;
  notify_on_cancel?: boolean;
  state?: string;
}

type DialogElement =
  | TextElement
  | SelectElement
  | RadioElement
  | BooleanElement;

interface BaseElement {
  display_name: string;
  name: string;
  type: string;
  subtype?: string;
  optional?: boolean;
  min_length?: number;
  max_length?: number;
  help_text?: string;
  default?: string | boolean;
  placeholder?: string;
}

interface TextElement extends BaseElement {
  type: "text";
  subtype?: "text" | "email" | "number" | "password" | "tel" | "url";
}

interface SelectElement extends BaseElement {
  type: "select";
  options?: { text: string; value: string }[];
  data_source?: "users" | "channels";
}

interface RadioElement extends BaseElement {
  type: "radio";
  options: { text: string; value: string }[];
}

interface BooleanElement extends BaseElement {
  type: "bool";
}

export class DialogBuilder {
  private dialog: Dialog;

  constructor(callbackId: string, title: string) {
    this.dialog = {
      callback_id: callbackId,
      title: title,
      elements: [],
    };
  }

  introductionText(text: string): this {
    this.dialog.introduction_text = text;
    return this;
  }

  submitLabel(label: string): this {
    this.dialog.submit_label = label;
    return this;
  }

  notifyOnCancel(notify: boolean): this {
    this.dialog.notify_on_cancel = notify;
    return this;
  }

  state(state: string): this {
    this.dialog.state = state;
    return this;
  }

  addElement(element: DialogElement): this {
    this.dialog.elements.push(element);
    return this;
  }

  textElement(options: Omit<TextElement, "type">): this {
    return this.addElement({ ...options, type: "text" });
  }

  selectElement(options: Omit<SelectElement, "type">): this {
    return this.addElement({ ...options, type: "select" });
  }

  radioElement(options: Omit<RadioElement, "type">): this {
    return this.addElement({ ...options, type: "radio" });
  }

  booleanElement(options: Omit<BooleanElement, "type">): this {
    return this.addElement({ ...options, type: "bool" });
  }

  build(): Dialog {
    return { ...this.dialog };
  }
}
