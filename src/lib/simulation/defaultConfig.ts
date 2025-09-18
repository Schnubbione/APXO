import yaml from 'yaml';
import rawConfig from '../../../apxo.config.yaml?raw';
import { Config } from './types';

export const defaultConfig: Config = yaml.parse(rawConfig) as Config;
