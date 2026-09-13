"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";


export default function Hero(){


return(


<section

className="
relative
min-h-screen
flex
items-center
overflow-hidden
bg-black
text-white
"

>


{/* BACKGROUND GLOW */}

<div

className="
absolute
top-1/2
left-1/2
-translate-x-1/2
-translate-y-1/2
w-[600px]
h-[600px]
bg-yellow-500/10
blur-[120px]
rounded-full
"

/>









<div className="
relative
z-10
max-w-7xl
mx-auto
w-full
px-6
grid
md:grid-cols-2
gap-10
items-center
">







{/* TEXT */}


<motion.div

initial={{
opacity:0,
x:-60
}}

animate={{
opacity:1,
x:0
}}

transition={{
duration:.8
}}

>



<p

className="
text-yellow-400
tracking-[0.5em]
uppercase
text-sm
mb-6
"

>

Luxury Fashion Brand

</p>







<h1

className="
text-6xl
md:text-8xl
font-black
leading-none
tracking-wider
"

>

AVEN

</h1>






<h2

className="
text-3xl
md:text-5xl
font-bold
mt-5
"

>

Timeless

<br/>

Elegance

</h2>







<p

className="
text-gray-400
mt-6
max-w-md
text-lg
leading-relaxed
"

>

Discover premium fashion collections
crafted with elegance, tradition and
modern luxury.

</p>







<div

className="
flex
gap-5
mt-10
"

>


<Link

href="/shop"

className="
bg-yellow-500
text-black
font-bold
px-8
py-4
rounded-full
hover:scale-105
transition
"

>

Explore Collection

</Link>






<Link

href="/about"

className="
border
border-yellow-500/40
px-8
py-4
rounded-full
hover:bg-yellow-500
hover:text-black
transition
"

>

About AVEN

</Link>



</div>





</motion.div>









{/* IMAGE */}


<motion.div


initial={{
opacity:0,
scale:.8
}}

animate={{
opacity:1,
scale:1
}}

transition={{
duration:1
}}

className="
relative
h-[600px]
"

>


<div

className="
absolute
inset-0
bg-yellow-500/20
blur-3xl
rounded-full
"

/>





<Image

src="/products/hero.png"

alt="AVEN Fashion"

fill

priority

className="
object-cover
rounded-[50px]
border
border-yellow-500/20
"

 />






</motion.div>





</div>









{/* SCROLL TEXT */}


<motion.div

animate={{
y:[0,15,0]
}}

transition={{
repeat:Infinity,
duration:2
}}

className="
absolute
bottom-10
left-1/2
-translate-x-1/2
text-gray-400
text-sm
tracking-widest
"

>

SCROLL

</motion.div>





</section>


);


}