#!/usr/bin/env ts-node
import { program } from '@caporal/core';
import { buildDataSet, setImageFolder } from './common';

program
    .option('--id [id]', 'config id', { default: '1' })
    .option('--crop', 'crop images?', { default: false, validator: program.BOOLEAN })
    .option('--width', 'image width', { default: 244, validator: program.NUMBER })
    .option('--imagesFolder [imagesFolder]', 'imagesFolder', { default: null })
    .option('--compress', 'compress images?', { default: false, validator: program.BOOLEAN })
    .action(async ({ logger, args, options }) => {
        if (options.imagesFolder) {
            setImageFolder(options.imagesFolder);
        }
        await buildDataSet(
            options.id + '',
            typeof options.crop === 'string' ? options.crop === 'true' : (options.crop as boolean),
            typeof options.compress === 'string' ? options.compress === 'true' : (options.compress as boolean),
            typeof options.width === 'string' ? parseInt(options.width, 10) : (options.width as number)
        );
    });

program.run();
