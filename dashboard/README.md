# Modular Dashboard

## GitHub Pages
Upload the entire contents of this `dashboard` folder to a folder named `dashboard` in the GitHub Pages repository.

Skröja is then opened with:

`https://lynoit.github.io/dashboard/?customer=skroja`

If `customer` is omitted, `skroja` is used by default.

## Structure

- `index.html` - common page shell
- `core/app.js` - all common functionality
- `core/styles.css` - common styling
- `core/bootstrap.js` - loads the selected customer config and then the core app
- `customers/skroja/config.js` - all Skröja-specific settings
- `customers/skroja/skroja-logo.png` - Skröja logo
- `customers/_template/config.js` - template for a new customer
- `assets/` - shared visual assets

## Add a new customer

1. Copy `customers/_template/` to `customers/<customer-id>/`.
2. Rename/add the customer's logo and update the logo path in `config.js`.
3. Update Azure account, container and SAS token in that customer's `config.js`.
4. Set modules to true/false as required.
5. Open `?customer=<customer-id>`.

No change in `core/` should be needed for customer-specific setup.

## Member CSV
The member CSV is read from the configured Azure container beside the activity JSON files.
Expected columns:

`namn;color;medlemsniva;dag;tid`
