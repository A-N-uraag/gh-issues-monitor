import { marked } from 'marked';
import { CronJob } from 'cron';

const NUM_DAYS = 14;

interface Issue {
    title: String,
    created_at: String,
    html_url: String
}

interface RepoEntry {
    name: String
}


const fetchLatestIssues = async function(){
    const repos: String = await Bun.file("repos.txt").text();
    let pageMarkDown = `# Latest Issues\nGenerated at ${new Date()}\n\n`;

    const findGoodFirstIssuesLast14Days = async function(org: String, repo: String) {
        const timeStamp6HoursAgo = new Date(Date.now()-NUM_DAYS*86400000).toISOString();
        const response = await fetch(`https://api.github.com/repos/${org}/${repo}/issues?labels=good%20first%20issue&assignee=none&since=${timeStamp6HoursAgo}&state=open`, {headers: {"Authorization": `Bearer ${process.env.GH_ACCESS_TOKEN}`}});
        const issuesList: Issue[] = JSON.parse(await response.text());
        if(!response.ok) {
            pageMarkDown += `### Failed to find issues for ${org}/${repo}!\n`;
            return;
        }
        if(issuesList.length > 0) {
            pageMarkDown += `## <font color="green">${org}/${repo}</font>\n`;
        }
        for(let issue of issuesList) {
            pageMarkDown += "---\n";
            pageMarkDown += `### [${issue.title}](${issue.html_url})\n`;
            pageMarkDown += `#### Created at: ${issue.created_at}\n`;
            pageMarkDown += "---\n";
        }
    }

    const getReposInOrg = async function(org: String) {
        let resp = await fetch(`https://api.github.com/orgs/${org}/repos?sort=pushed`, {headers: {"Authorization": `Bearer ${process.env.GH_ACCESS_TOKEN}`}});
        if(!resp.ok) {
            pageMarkDown += `### Failed to fetch repos under ${org}!\n`;
            return [];
        }
        let repoEntries: RepoEntry[] = JSON.parse(await resp.text());
        let repoNamesList = repoEntries.map(repoEntry => {
            return repoEntry.name;
        });
        return repoNamesList;
    }

    const getExpensifyBounties = async function() {
        const [org, repo] = ["Expensify", "App"];
        const timeStamp6HoursAgo = new Date(Date.now()-NUM_DAYS*86400000).toISOString();
        const response = await fetch(`https://api.github.com/repos/${org}/${repo}/issues?labels=Help%20Wanted&since=${timeStamp6HoursAgo}&state=open`, {headers: {"Authorization": `Bearer ${process.env.GH_ACCESS_TOKEN}`}});
        const issuesList: Issue[] = JSON.parse(await response.text());
        if(!response.ok) {
            pageMarkDown += `### Failed to find issues for ${org}/${repo}!\n`;
            return;
        }
        if(issuesList.length > 0) {
            pageMarkDown += `## <font color="green">${org}/${repo}</font>\n`;
        }
        for(let issue of issuesList) {
            pageMarkDown += "---\n";
            pageMarkDown += `### [${issue.title}](${issue.html_url})\n`;
            pageMarkDown += `#### Created at: ${issue.created_at}\n`;
            pageMarkDown += "---\n";
        }
    }

    const reposListFromFile: String[] = repos.split('\n');
    const reposList = [... new Set(reposListFromFile) ]
    for(let org_repo of reposList) {
        let [org, repo] = org_repo.split('/');
        if(org_repo === "Expensify/App") {
            await getExpensifyBounties();
        }
        if(repo === "*") {
            let reposUnderOrg = await getReposInOrg(org);
            for(let repoName of reposUnderOrg) {
                await findGoodFirstIssuesLast14Days(org, repoName);
            }
        }
        else {
            await findGoodFirstIssuesLast14Days(org, repo);
        }
    };
    Bun.write("./index.html", marked.parse(pageMarkDown));
}

var job = new CronJob(
    '0 */3 * * *',
    fetchLatestIssues,
    null,
    true,
    'Asia/Kolkata'
);

await fetchLatestIssues();
console.log("Fetched issues on Startup");
job.start();

Bun.serve({
    async fetch(req) {
        const url = new URL(req.url);
        if(url.pathname === "/") {
            fetchLatestIssues();
            return new Response(Bun.file("./index.html"), {headers: {"content-type": "html"}});
        }
        return new Response(`404!`);
        
    },
    port: 3000
  });

export{}