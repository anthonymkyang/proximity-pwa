"use client";

import { Badge } from "@/components/ui/badge";
import {
  Star,
  ShoppingBag,
  Search,
  Pin,
  Clock3,
  Truck,
  CreditCard,
  HelpCircle,
  ClipboardList,
} from "lucide-react";
import TopBar from "@/components/nav/TopBar";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";

const products = [
  {
    id: "p1",
    name: "Wireless Earbuds Pro",
    price: "£29.99",
    oldPrice: "£59.99",
    sold: "12.4k sold",
    badge: "Flash",
    rating: "4.8",
  },
  {
    id: "p2",
    name: "Oversized Hoodie",
    price: "£19.99",
    oldPrice: "£39.99",
    sold: "8.1k sold",
    badge: "Hot",
    rating: "4.6",
  },
  {
    id: "p3",
    name: "LED Strip Lights",
    price: "£14.50",
    oldPrice: "£24.99",
    sold: "15.9k sold",
    badge: "Deal",
    rating: "4.7",
  },
  {
    id: "p4",
    name: "Fitness Tracker",
    price: "£24.00",
    oldPrice: "£49.00",
    sold: "9.3k sold",
    badge: "Flash",
    rating: "4.5",
  },
];

export default function ShopPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-28">
      <TopBar
        leftContent={
          <div className="w-full">
            <InputGroup>
              <InputGroupAddon>
                <Search className="h-4 w-4 text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                inputMode="search"
                className="text-base"
                defaultValue="£ 40 mystery bundle"
              />
            </InputGroup>
          </div>
        }
        rightContent={
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <ShoppingBag className="h-5 w-5" />
          </div>
        }
      />
      <header className="py-0">
        <h1 className="px-1 pb-3 text-4xl font-extrabold tracking-tight">
          Shop
        </h1>
      </header>

      <section className="space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <Button variant="outline" size="sm" className="rounded-full gap-2">
            <ShoppingBag className="h-4 w-4" />
            My orders
          </Button>
          <Button variant="outline" size="sm" className="rounded-full gap-2">
            <Pin className="h-4 w-4" />
            Pinned
          </Button>
          <Button variant="outline" size="sm" className="rounded-full gap-2">
            <Clock3 className="h-4 w-4" />
            Recently viewed
          </Button>
          <Button variant="outline" size="sm" className="rounded-full gap-2">
            <Truck className="h-4 w-4" />
            Shipping
          </Button>
          <Button variant="outline" size="sm" className="rounded-full gap-2">
            <CreditCard className="h-4 w-4" />
            Payments
          </Button>
          <Button variant="outline" size="sm" className="rounded-full gap-2">
            <HelpCircle className="h-4 w-4" />
            Help
          </Button>
        </div>

        {/* Hero banner */}
        <div className="overflow-hidden rounded-2xl bg-linear-to-r from-amber-700 via-amber-500 to-amber-300 text-white shadow">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="text-xs font-semibold uppercase opacity-80">
                Marketplace
              </p>
              <h2 className="text-2xl font-extrabold leading-tight">
                Worn socks
              </h2>
              <div className="mt-2 inline-flex rounded-full bg-black/30 px-3 py-1 text-xs font-semibold">
                Shop Now
              </div>
            </div>
            <div className="relative h-20 w-20 rounded-full bg-white/20">
              <div className="absolute inset-2 rounded-full bg-white/40 blur-xl" />
              <div className="absolute inset-4 rounded-full bg-amber-200/80" />
            </div>
          </div>
        </div>

        {/* Deals card */}
        <div className="overflow-hidden rounded-2xl bg-muted/40 shadow">
          <div className="flex items-center gap-2 px-4 pt-3">
            <h3 className="text-lg font-bold">Today&apos;s deals</h3>
            <Badge className="bg-rose-500 text-white text-xs font-semibold">
              Up to 40% off
            </Badge>
          </div>
          <div className="grid grid-cols-4 gap-4 px-4 pb-4 pt-2">
            {["£29.40", "£5.66", "£33.65", "£19.99"].map((price) => (
              <div key={price} className="flex flex-col items-center gap-2">
                <div className="h-28 w-full rounded-xl bg-card/70" />
                <span className="text-sm font-semibold">{price}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Featured + Spotlight cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#d7f3f7] px-4 py-4 text-slate-900 shadow">
            <div className="grid grid-cols-2 gap-2 items-start">
              <div>
                <p className="text-lg font-bold leading-tight">
                  Featured brands
                </p>
                <p className="mt-1 text-sm font-semibold uppercase tracking-wide">
                  Kvrt
                </p>
              </div>
              <div className="h-16 rounded-lg bg-white/40" />
            </div>
          </div>
          <div className="rounded-2xl bg-[#e8e5f6] px-4 py-4 text-slate-900 shadow">
            <div className="grid grid-cols-2 gap-2 items-start">
              <div>
                <p className="text-lg font-bold">Spotlight</p>
                <div className="mt-1 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-purple-700">
                  Daily coupon
                </div>
              </div>
              <div className="h-16 rounded-xl bg-white/70" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {products.map((product) => (
            <div
              key={product.id}
              className="overflow-hidden rounded-xl bg-card/80 shadow-sm"
            >
              <div className="relative aspect-square w-full bg-card/60">
                <div className="absolute left-2 top-2">
                  <Badge className="bg-black text-white text-[11px] uppercase">
                    {product.badge}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1 px-3 py-3">
                <p className="text-sm font-semibold text-foreground line-clamp-2">
                  {product.name}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-foreground">
                    {product.price}
                  </span>
                  <span className="text-xs text-muted-foreground line-through">
                    {product.oldPrice}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    {product.rating}
                  </span>
                  <span>{product.sold}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
