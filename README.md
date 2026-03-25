# AmenityGap-NYC
A web platform that helps entrepreneurs and residents identify underserved neighborhoods across New York City. Instead of showing where amenities like laundromats, pharmacies, or delis currently exist, it reveals where they're missing relative to population demand.



## Getting Started

Follow these steps to set up and run the project locally.

1. Clone the Repository

```bash
git clone https://github.com/Junh513/AmenityGap-NYC.git
cd AmenityGap-NYC
```

---

2. Create/Activate Virtual Environment

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

---

3. Install Dependencies

```bash
pip install -r requirements.txt
```

---

4. Environment Variables

Sensitive credentials are not stored in GitHub:

- Create a `.env` file in AMENITYGAP-NYC directory. (Ignore this if you are not an active contributor)
- Create a separate `.env` file within ~\frontend\amenitygap-app for `VITE_MAPBOX_TOKEN`.
- For `VITE_MAPBOX_TOKEN`, create a free account at https://account.mapbox.com/ and copy your default public token.
- Copy the structure from `.env.example.`
- Fill in the Supabase URL and KEY with the values from our groupchat.

---

5. How to Run

The application requires both the backend and frontend to be running simultaneously.

Note: If you are not an active contributor, skip the backend step. Cached data will be used instead.
**Start the backend:**
```bash
cd AmenityGap-NYC/backend
npm install        # first time only
npm run start
```
This initializes the Express server and connects to Supabase.

**Start the frontend (in a separate terminal):**
```bash
cd AmenityGap-NYC/frontend/amenitygap-app
npm install        # first time only
npm run dev
```
Open the localhost link displayed in the terminal. Both servers must remain running for the app to function normally.

---

# For Repo Contributors Only

Everything below is intended for active contributors to this repository.

---

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

* **Never Sit on Code:** If you've finished your work for the day, push it to your branch. Even if it's not "ready to merge," having it on GitHub acts as a backup and lets the team see your progress.

* **Sync Before You Start:** Every morning (or whenever you sit down to code), run `git checkout main` and `git pull origin main`. This ensures you aren't building on top of an outdated version of the project.

---

## Running the ETL

AmenityGap uses a unified Python ETL pipeline to manage our data. It handles Extraction (OpenStreetMap), Transformation (H3 Spatial Indexing), and Loading (Supabase Cloud DB).

1. Syncing the Database (Admin)

    To pull fresh NYC data and sync it to our Supabase instance, run the ETL script from the root directory:
    ```
    # Sync all supported amenities at once
    python ./data_exploration/etl.py --type all

    # Or sync a specific category (options: deli, laundry, pharmacy)
    python ./data_exploration/etl.py --type laundry
    ```
    - H3 Indexing: The script automatically generates H3 indices (Res 7, 8, and 9) for every location.

    - Deduplication: Uses upsert logic so running the script multiple times won't create duplicate entries.


2. Fetching Data for the App (Team)

    I've provided a utility script, `supabase_utils.py`, so you don't have to write raw database queries. Just import the helper function:

    ```
    from data_exploration.supabase_utils import get_amenities_by_type

    # Returns a list of dictionaries with all NYC laundromats + H3 indices
    laundromats = get_amenities_by_type("laundry")
    ```