#!/usr/bin/env ts-node
import { program } from '@caporal/core';
import { buildDataSet } from './common';

program
    .option('--id [id]', 'config id', { default: '1' })
    .option('--crop', 'crop images?', { default: false, validator: program.BOOLEAN })
    .option('--compress', 'compress images?', { default: false, validator: program.BOOLEAN })
    .action(async ({ logger, args, options }) => {
        await buildDataSet(
            options.id + '',
            typeof options.crop === 'string' ? options.crop === 'true' : (options.crop as boolean),
            typeof options.compress === 'string' ? options.compress === 'true' : (options.compress as boolean)
        );
    });

program.run();
