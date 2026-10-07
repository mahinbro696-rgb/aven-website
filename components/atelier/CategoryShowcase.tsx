"use client";

import type { Product } from "@/lib/atelier";
import {
  productCategories,
  productsInCategory,
  type ShopCategory,
} from "@/lib/shop-categories";
import { Icon, Photo } from "./Primitives";

export default function CategoryShowcase({
  products,
  selected,
  onSelect,
  managed = [],
}: {
  products: Product[];
  selected: string;
  onSelect: (key: string) => void;
  managed?: ShopCategory[];
}) {
  const categories = productCategories(products, managed);

  return (
    <section className="av-category-hub av-section" id="collections" aria-labelledby="category-title">
      <div className="av-container">
        <div className="av-category-heading">
          <div>
            <p className="av-eyebrow">01 / SHOP BY COLLECTION</p>
            <h2 id="category-title">
              আগে বেছে নিন <em>আপনার কালেকশন।</em>
            </h2>
          </div>
          <p>
            কুশিকাটা, জামদানি বা অন্য collection—প্রথমে category বেছে নিন।
            তারপর সেই category-র সব প্রকাশিত product একসাথে দেখুন।
          </p>
        </div>

        <div className="av-category-grid">
          {categories.map((category, index) => {
            const items = productsInCategory(products, category.key);
            return (
              <CategoryCard
                key={category.key}
                category={category}
                items={items}
                index={index}
                active={selected === category.key}
                onSelect={() => onSelect(category.key)}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CategoryCard({
  category,
  items,
  index,
  active,
  onSelect,
}: {
  category: ShopCategory;
  items: Product[];
  index: number;
  active: boolean;
  onSelect: () => void;
}) {
  const hasProducts = items.length > 0;
  const previews = items.slice(0, 3);

  return (
    <article className={`av-category-card ${active ? "is-active" : ""} ${!hasProducts ? "is-empty" : ""}`}>
      <button
        type="button"
        onClick={onSelect}
        disabled={!hasProducts}
        aria-label={hasProducts ? `${category.name} collection দেখুন` : `${category.name} এখনো প্রকাশিত হয়নি`}
      >
        <div className="av-category-visual">
          {hasProducts ? (
            <>
              <Photo
                src={previews[0].mainImage}
                alt={`${category.name} collection`}
                sizes="(max-width: 680px) 92vw, 32vw"
              />
              {previews.slice(1).map((product, previewIndex) => (
                <span
                  className={`av-category-mini av-category-mini-${previewIndex + 1}`}
                  key={product.id}
                  aria-hidden="true"
                >
                  <Photo src={product.mainImage} alt="" sizes="100px" />
                </span>
              ))}
              <span className="av-category-overlay" />
            </>
          ) : (
            <div className="av-category-placeholder" aria-hidden="true">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <i />
              <i />
              <i />
            </div>
          )}

          <span className="av-category-index">{String(index + 1).padStart(2, "0")}</span>
          <span className="av-category-status">
            {hasProducts
              ? `${new Intl.NumberFormat("bn-BD").format(items.length)}টি ডিজাইন`
              : "শিগগিরই"}
          </span>
        </div>

        <div className="av-category-copy">
          <p>{category.eyebrow}</p>
          <h3>{category.name}</h3>
          <span>{category.description}</span>
          <strong>
            {hasProducts ? (
              <>কালেকশন দেখুন <Icon name="arrow" size={17} /></>
            ) : (
              "নতুন পণ্য প্রকাশের অপেক্ষায়"
            )}
          </strong>
        </div>
      </button>
    </article>
  );
}
