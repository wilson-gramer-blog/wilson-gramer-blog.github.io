# Wilson Gramer's Blog

## Project structure

- `posts`: contains published posts.
- `docs`: contains the built output. Automatically updated with every commit.
- `templates`: contains HTML templates for posts and the homepage.
- `styles`: contains CSS styles for the built output.
- `generate.js` script to generate website from the above folders.

## Scripts

- `npm start`: builds the website to the `docs` directory.
- `npm run watch`: runs a development server that automatically rebuilds the `docs` folder and refreshes the browser tab when any change is made.
