import path from 'path';
import { buildDataSet, getFolder } from './common';
import { program } from '@caporal/core';

program.option('--id [id]', 'config id', { default: '1' }).action(({ logger, args, options }) => {
    buildDataSet(options.id + '');
});

program.run();
