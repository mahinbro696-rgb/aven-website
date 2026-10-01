"use client";
import { changeLine, lineKey, toMinor, type BagLine } from "@/lib/commerce";
import { money, type Product } from "@/lib/atelier";
import { Icon, Photo, Quantity } from "./Primitives";
import { useCommerce } from "./CommerceState";

export function BagLines({ items, products, onChange, onRemove, disabled = false }: {
  items: BagLine[]; products: Product[]; onChange: (next: BagLine[]) => void; onRemove: (line: BagLine) => void; disabled?: boolean;
}) {
  const { inform } = useCommerce();
  const edit = (key: string, patch: Partial<Pick<BagLine, "color" | "quantity">>) => {
    try { onChange(changeLine(items, key, patch)); } catch (error) { inform(error instanceof Error ? error.message : "পরিমাণ যাচাই করুন।"); }
  };
  return <div className="av-bag-lines">{items.map((line) => {
    const product = products.find((p) => p.id === line.productId);
    const valid = product?.available && product.price > 0 && (!product.colors.length || product.colors.some((c) => c.name === line.color));
    return <article className={`av-bag-line ${!valid ? "is-unavailable" : ""}`} key={lineKey(line)}>
      <div className="av-bag-photo">{product ? <Photo key={line.color} src={product.colors.find((c) => c.name === line.color)?.image || product.mainImage} alt={product.name} sizes="110px" /> : <Icon name="bag" size={32} />}</div>
      <div className="av-bag-line-copy"><span className="av-bag-category">{product?.category || "AVEN COLLECTION"}</span><h3>{product?.name || "পণ্যটি এখন পাওয়া যাচ্ছে না"}</h3>
        {product?.colors.length ? <label className="av-bag-color">রঙ<select value={line.color} disabled={disabled} onChange={(event) => edit(lineKey(line), { color: event.target.value })} aria-label={`${product.name} রঙ`}>
          {!product.colors.some((c) => c.name === line.color) && <option value={line.color}>রঙ আবার বেছে নিন</option>}
          {product.colors.map((color) => <option key={color.name} value={color.name}>{color.name}</option>)}
        </select></label> : line.color && <p className="av-small">{line.color}</p>}
        {!valid && <p className="av-bag-error">পণ্য/রঙ আপডেট করুন অথবা ব্যাগ থেকে সরান।</p>}
        <div className="av-bag-line-bottom"><fieldset disabled={disabled} aria-label="পণ্যের পরিমাণ"><Quantity value={line.quantity} onChange={(quantity) => edit(lineKey(line), { quantity })} /></fieldset>
          <strong>{product ? money(toMinor(product.price) * line.quantity / 100) : "—"}</strong></div>
      </div>
      <button className="av-bag-remove" type="button" disabled={disabled} aria-label={`${product?.name || "পণ্য"} ব্যাগ থেকে সরান`} onClick={() => onRemove(line)}><Icon name="close" size={16} /></button>
    </article>;
  })}</div>;
}
export function bagTotal(items: BagLine[], products: Product[]): number {
  return items.reduce((sum, line) => sum + toMinor(products.find((p) => p.id === line.productId)?.price || 0) * line.quantity, 0) / 100;
}
export function validBag(items: BagLine[], products: Product[]): boolean {
  return items.length > 0 && items.every((line) => {
    const p = products.find((product) => product.id === line.productId);
    return p && p.available && p.price > 0 && (!p.colors.length || p.colors.some((c) => c.name === line.color));
  });
}
