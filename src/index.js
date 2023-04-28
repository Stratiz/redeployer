import dotenv from 'dotenv';
import config from './config';
import { exec } from 'child_process';
import cron from 'node-cron';

dotenv.config();

const COMMANDS = [
    `rm -Rf ./.build`,
    `mkdir ./.build`,
    `git clone ${config.repository.gitUrl} ./.build`,
    `cd ./.build`,
    `npm i`,
    config.commands.build,
    ...config.preservedFiles.map((path) => `cp ${config.appDirectory}/${path} ./.build/${path}`),
    config.commands.start,
];

let currentSha = "";

async function redeploy() { 
    console.log("Redeploying app...");

    for (command of COMMANDS) {
        try {
            await new Promise((resolve, reject) => {
                exec(command, (error, stdout, stderr) => {
                    if (error || stderr) {
                        console.log(`Failed to execute command: ${command}`);
                        console.log(`Error: ${error ? error.message : stderr}`);
                        reject();
                        return
                    }

                    console.log(`Command executed: ${command}`);
                    resolve();
                });
            });
        } catch (error) {
            console.log("Failed to deploy:", error);
            break;
        }
    }
}

async function init() {
    exec(`eval "$(ssh-agent -s)"`, () => {
        exec(`ssh-add ${config.ssh.keyLocation} -p ${process.env.SSH_PW}`);
    });
}

init();

cron.schedule('*/2 * * * *', () => {
    fetch(`https://api.github.com/repos/${config.repository.owner}/${config.repository.name}/commits/${config.repository.branch}`)
    .then((response) => response.json())
    .then((data) => {
        if (data.sha != currentSha) {
            currentSha = data.sha;
            redeploy();
        }
    })
    .catch((error) => {
        console.log("Failed to fetch repo data:", error);
    });
});


