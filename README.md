# AmenityGap-NYC
A web platform that helps entrepreneurs and residents identify underserved neighborhoods across New York City. Instead of showing where amenities like laundromats, pharmacies, or delis currently exist, it reveals where they're missing relative to population demand.



## Environment Setup

To ensure all dependencies are consistent and avoid pip install library issues, follow these steps:

1. Create/Activate Virtual Environment

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

---

2. Install Dependencies

```bash
pip install -r requirements.txt
```

---

3. Environment Variables

Sensitive credentials are not stored in GitHub:

- Create a `.env` file in your root directory.
- Copy the structure from `.env.example.`
- Fill in the Supabase URL and KEY with the values from our groupchat.


## Git Standards (Branching & PRs)

To keep our main branch stable and to avoid overwriting others' code, *do not* push to main. 

Instead, whenever you start working:

1. Pull latest changes to your local IDE

```
git checkout main
git pull origin main
```

---

2. Create a branch
```
git checkout -b feature/your-feature-name # Use chore/ for documentation or cleanup
```

---

3. Make your changes 

    You're now ready to start working on your feature!

---

4. Commit your changes

    If you're in VS Code you can use the version control tab to do this easily, or in terminal:

```
git add .
git commit -m 'feat: brief description of changes'
```
    So far, this is all local and doesn't upload anything to Github

---

5. Push your changes

    Once you're ready to update the GitHub with your changes, do the following:

```
git push origin feature/your-feature-name
```

    Or you can do this in the VSCode version control sidebar as well 

---

6. Create a Pull Request (PR)

- Go to the repository on GitHub
- Click on the yellow banner saying **"Compare & pull request"**
- Add a description of what you changed
- Click **"Create pull request"**

---

7. Ask for Merge

- Notify the group chat that you created a PR
- At least one other person will check your code for errors and conflicts
- If everything checks out, they can hit `merge pull request`
- This then closes your feature branch and updates the main branch with your changes

---

### Team Workflow Pro-Tips

* **Commit Small, Commit Often:** Don't wait until the entire feature is finished to commit. If you finish a single function or fix one bug, commit it! This prevents "Merge Hell" later on.

* **Never Sit on Code:** If you’ve finished your work for the day, push it to your branch. Even if it’s not "ready to merge," having it on GitHub acts as a backup and lets the team see your progress.

* **Sync Before You Start:** Every morning (or whenever you sit down to code), run `git checkout main` and `git pull origin main`. This ensures you aren't building on top of an outdated version of the project.

---

## Running the ETL

I've already set up the Python ETL script that handles our data. Here's how to run it:

1. Run `python ./data_exploration/etl.py --type deli` in your terminal in root directory (currently supported flags: `deli`, `laundry`, `pharmacy`)

2. It will try to pull fresh data from OSM and organize it for our map

3. It also generates the H3 indices for each result so we don't have to calculate this again later

I'm hoping to add parameters to the etl script soon to update certain amenities, so expect changes in the near future!