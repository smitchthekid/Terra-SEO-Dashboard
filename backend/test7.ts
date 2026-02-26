import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const url = 'https://api.serpstat.com/v4?token=' + process.env.SERPSTAT_API_TOKEN;

async function test(method: string, params: any = {}) {
    try {
        const res = await axios.post(url, { id: 1, method, params });
        const msg = res.data?.error?.message;
        if (msg && msg !== 'Method not found') {
            console.log('FOUND:', method, res.data);
        } else if (!msg) {
            console.log('SUCCESS:', method);
        }
    } catch (e: any) {
    }
}

async function run() {
    const prefixes = ['RtApi', 'Rt', 'Serpstat', 'SerpstatApi'];
    const namespaces = ['Keyword', 'Tag', 'Category', 'Project', 'Competitor', 'SearchEngine', 'Domain', 'Url', 'Site', 'Position'];
    const actions = ['getTag', 'getTags', 'getProjectTags', 'getKeywordTags', 'getProjectKeywords'];

    for (const p of prefixes) {
        for (const n of namespaces) {
            for (const a of actions) {
                const method = `${p}${n}Procedure.${a}`;
                await test(method, { projectId: 1171287 });
            }
        }
    }
}
run();
