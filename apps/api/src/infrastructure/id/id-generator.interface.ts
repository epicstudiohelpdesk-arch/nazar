export interface IIdGenerator {
  generate(): string;
  isValid(id: string): boolean;
}

export const ID_GENERATOR_TOKEN = Symbol('IIdGenerator');
