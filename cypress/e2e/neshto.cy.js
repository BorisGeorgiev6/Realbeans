describe('E-commerce Store Tests', () => {
  const STORE_URL = 'https://r0972798-realbeans.myshopify.com';
  const STORE_PASSWORD = 'daobeu';

  beforeEach(() => {
    Cypress.on('uncaught:exception', () => false);
    cy.intercept('POST', '/api/2025-04/graphql.json').as('graphql');
    cy.visit(STORE_URL, { failOnStatusCode: false });
    cy.get('body').then(($body) => {
      if ($body.find('#shopify-pc__banner__btn-accept').length > 0) {
        cy.get('#shopify-pc__banner__btn-accept', { timeout: 5000 }).should('be.visible').click();
        cy.wait(3000);
      }
      if ($body.find('input[name="password"]').length > 0) {
        cy.get('input[name="password"]').type(STORE_PASSWORD);
        cy.get('form').submit();
        cy.wait('@graphql', { timeout: 10000 });
      }
    });
    cy.url().should('not.include', '/password');
  });

  it('Homepage displays intro text and product list correctly', () => {
    cy.intercept('POST', '/api/2025-04/graphql.json').as('graphql');
    cy.visit(STORE_URL);
    cy.wait('@graphql', { timeout: 10000 });
    cy.get('h1.header__heading, .hero__inner .h2, .banner__text')
      .should('be.visible')
      .then(($el) => cy.log('Intro element found:', $el.text()));
    cy.get('ul.grid li.grid__item').as('products');
    cy.get('@products').should('have.length.at.least', 1);
    cy.get('@products').first().within(() => {
      cy.get('img').should('be.visible');
      cy.get('.price__regular .price-item').should('be.visible');
      cy.get('.card__heading').should('be.visible');
    });
  });

  it('Product catalog shows correct items', () => {
    cy.intercept('POST', '/api/2025-04/graphql.json').as('graphql');
    cy.visit(`${STORE_URL}/collections/all`);
    cy.wait('@graphql', { timeout: 10000 });
    cy.scrollTo('bottom');
    cy.wait(1000);
    cy.get('ul.grid li.grid__item').as('products');
    cy.get('@products').should('have.length.at.least', 1);
    cy.get('@products').each(($product) => {
      cy.wrap($product).within(() => {
        cy.get('img').should('be.visible');
        cy.get('.price__regular .price-item').should('be.visible');
        cy.get('.card__heading').should('be.visible');
      });
    });
  });

  it('Sorting products by price changes their order', () => {
    cy.intercept('POST', '/api/2025-04/graphql.json').as('graphql');
    cy.visit(`${STORE_URL}/collections/all`);
    cy.wait('@graphql', { timeout: 10000 });
    cy.scrollTo('bottom');
    cy.wait(1000);
    cy.wait(500);
    cy.get('button:contains("Accept")').click({ force: true });
    cy.get('ul.grid li.grid__item').as('products');
    cy.get('@products').should('be.visible');
    cy.get('.price__regular .price-item').as('prices');
    cy.get('@prices').then(($prices) => {
      const initialPrices = Array.from($prices).map((el) => {
        const rawPrice = el.textContent.trim();
        cy.log('Raw price:', rawPrice);
        const numericPart = rawPrice.replace('From', '').replace('EUR', '').trim();
        const priceValue = parseFloat(numericPart.replace('€', '').replace(',', '.'));
        return priceValue;
      });
      cy.log('Initial prices:', initialPrices);
      cy.get('select#SortBy, select[name="sort_by"]').first().select('price-ascending', { force: true });
      cy.wait('@graphql', { timeout: 10000 });
      cy.scrollTo('bottom');
      cy.wait(2000);
      cy.get('.price__regular .price-item').as('sortedPrices');
      cy.get('@sortedPrices').should(($els) => {
        const prices = Array.from($els).map((el) => {
          const rawPrice = el.textContent.trim();
          const numericPart = rawPrice.replace('From', '').replace('EUR', '').trim();
          return parseFloat(numericPart.replace('€', '').replace(',', '.'));
        });
        for (let i = 0; i < prices.length - 1; i++) {
          expect(prices[i]).to.be.at.most(prices[i + 1], `Price at index ${i} (${prices[i]}) should be <= index ${i + 1} (${prices[i + 1]})`);
        }
      }, { timeout: 10000 });
      cy.get('@sortedPrices').then(($sortedPrices) => {
        const sortedPrices = Array.from($sortedPrices).map((el) => {
          const rawPrice = el.textContent.trim();
          cy.log('Raw sorted price:', rawPrice);
          const numericPart = rawPrice.replace('From', '').replace('EUR', '').trim();
          return parseFloat(numericPart.replace('€', '').replace(',', '.'));
        });
        cy.log('Sorted prices:', sortedPrices);
      });
      cy.url().should('include', 'sort_by=price-ascending');
    });
  });

  it('Displays correct product details', () => {
    cy.intercept('POST', '/api/2025-04/graphql.json').as('graphql');
    cy.visit(`${STORE_URL}/collections/all`);
    cy.wait('@graphql', { timeout: 10000 });
    cy.scrollTo('bottom');
    cy.wait(1000);
    cy.get('body').then(($body) => {
      if ($body.find('#shopify-pc__banner__btn-accept').length > 0) {
        cy.get('#shopify-pc__banner__btn-accept', { timeout: 5000 }).should('be.visible').click();
        cy.wait(3000);
      } else {
        cy.log('Cookie banner already accepted or not present');
      }
    });
    cy.get('.grid__item').first().find('.card__heading a', { timeout: 10000 }).should('be.visible')
      .first()
      .then(($link) => {
        cy.log('Product link href:', $link.attr('href'));
        cy.wrap($link).click({ force: true });
      });
    cy.url().should('include', '/products');
    cy.wait('@graphql', { timeout: 10000 });
    cy.scrollTo('bottom');
    cy.wait(3000);
    cy.get('.product__description', { timeout: 10000 }).should('not.be.empty');
    cy.get('.price__regular .price-item', { timeout: 10000 })
      .scrollIntoView()
      .should('be.visible')
      .invoke('text').then((priceText) => {
        cy.log('Product page price:', priceText);
        expect(priceText).to.not.be.empty;
        expect(priceText).to.match(/€?\d+[\.,]\d{2}\s?EUR/);
      });
    cy.get('.product__media img', { timeout: 10000 })
      .should('have.attr', 'src')
      .and('not.be.empty');
  });

  it('About page includes history paragraph', () => {
    cy.intercept('POST', '/api/2025-04/graphql.json').as('graphql');
    cy.visit(`${STORE_URL}/pages/about`, { failOnStatusCode: false });
    cy.wait('@graphql', { timeout: 10000 });
    cy.wait(500);
    cy.get('button:contains("Accept")').click({ force: true });
    cy.get('h1, h2, .page-title').should('contain.text', 'About');
    cy.get('main p').should('have.length.at.least', 1)
      .then(($el) => cy.log('About page content found:', $el.text()));
    cy.get('main').invoke('text').then((text) => {
      expect(text.length).to.be.greaterThan(50);
    });
  });
});