#!/usr/bin/env ts-node
import { program } from '@caporal/core';
import { buildDataSet } from './common';

program
    .option('--id [id]', 'config id', { default: '1' })
    .option('--crop', 'crop images?', { default: false, validator: program.BOOLEAN })
    .action(({ logger, args, options }) => {
        console.log('test', options);
        buildDataSet(options.id + '', typeof options.crop === 'string' ? options.crop === 'true' : (options.crop as boolean));
    });

program.run();
