import {Adapter} from 'js-data-adapter'

interface IDict {
  [key: string]: any;
}
interface IBaseAdapter extends IDict {
  debug?: boolean,
  raw?: boolean
}
interface IBaseDocumentDBAdapter extends IBaseAdapter {
  documentOpts?: any
}
export class DocumentDBAdapter extends Adapter {
  static extend(instanceProps?: IDict, classProps?: IDict): typeof DocumentDBAdapter
  constructor(opts?: IBaseDocumentDBAdapter)
}
export interface OPERATORS {
  '==': Function
  '===': Function
  '!=': Function
  '!==': Function
  '>': Function
  '>=': Function
  '<': Function
  '<=': Function
  'in': Function
  'notIn': Function
  'contains': Function
  'notContains': Function
}
export interface version {
  full: string
  minor: string
  major: string
  patch: string
  alpha: string | boolean
  beta: string | boolean
}