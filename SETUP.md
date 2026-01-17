# Setup Instructions for Early Access Authentication

## Step 1: Create `.env.local` file

Create a file named `.env.local` in the project root with the following content:

```bash
# Convex URL (will be auto-populated when you run npx convex dev)
VITE_CONVEX_URL=
```

## Step 2: Start Convex Backend

In one terminal, run:

```bash
npx convex dev
```

This will:
- Start the Convex development server
- Automatically populate `VITE_CONVEX_URL` in your `.env.local` file
- Watch for changes in your `convex/` directory

## Step 3: Start Frontend

In a **second terminal**, run:

```bash
bun run dev:frontend
```

This will start Vite on http://localhost:3000

## Step 4: Sign Up and Bootstrap Admin

1. Open http://localhost:3000 in your browser
2. You should see the authentication screen
3. Click "Sign up" and create an account with your email and password
4. After signing up, you'll see the "Request Access" screen

## Step 5: Make Yourself Admin

1. Go to your Convex Dashboard: https://dashboard.convex.dev
2. Select your project
3. Go to "Functions" tab
4. Find and run the `users:bootstrapAdmin` mutation
5. Pass your email as the argument:
   ```json
   {
     "email": "your-email@example.com"
   }
   ```
6. Refresh the page - you should now have full access!

## Step 6: Approve Other Users

1. After you're admin, you'll see an "Admin" tab in the navigation
2. Go to Admin → Access Requests
3. Review and approve/reject user requests

## Troubleshooting

### Blank page or authentication not working
- Check browser console for errors (F12)
- Make sure both `npx convex dev` and `bun run dev:frontend` are running
- Make sure `.env.local` has `VITE_CONVEX_URL` set

### "User not found" when bootstrapping admin
- Make sure you've signed up first through the UI
- Use the exact email you signed up with
- Wait a few seconds after signup before running bootstrapAdmin

### Password requirements
- Passwords must be at least 8 characters long

## Environment Variables Reference

- `VITE_CONVEX_URL` - Your Convex deployment URL (auto-set by `npx convex dev`)
