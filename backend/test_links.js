const https = require('https');
const url = 'https://api-docs.serpstat.com/docs/serpstat-public-api/fbbvt84sg54bg-rank-tracker-api';
https.get(url, res => {
    let html = '';
    res.on('data', chunk => html += chunk);
    res.on('end', () => {
        const links = html.match(/href=\"([^\"]+)\"/g) || [];
        console.log('Total Links:', links.length);
        const related = links.filter(l => l.includes('rank-tracker'));
        console.log(related.join('\n'));
    });
});
