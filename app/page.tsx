"use client";

import Image from "next/image";
import Link from "next/link";
import {motion} from "framer-motion";

import ProductGrid from "@/components/ProductGrid";


export default function Home(){


return(


<main className="
min-h-screen
bg-[#050505]
text-white
overflow-hidden
">





{/* NAVBAR */}


<nav className="
fixed
top-0
left-0
right-0
z-50
">

<div className="
max-w-7xl
mx-auto
px-6
pt-5
">


<div className="
glass
px-7
py-4
flex
items-center
justify-between
">


<h1 className="
text-3xl
font-black
tracking-[12px]
text-yellow-400
">

AVEN

</h1>





<div className="
hidden
md:flex
gap-10
text-gray-300
font-medium
">


<Link
href="/"
className="hover:text-yellow-400 transition"
>
হোম
</Link>


<Link
href="#collections"
className="hover:text-yellow-400 transition"
>
কালেকশন
</Link>


<Link
href="#products"
className="hover:text-yellow-400 transition"
>
পণ্য
</Link>


<Link
href="#contact"
className="hover:text-yellow-400 transition"
>
যোগাযোগ
</Link>


</div>






<button className="
gold-btn
text-sm
">

এখনই কিনুন

</button>



</div>


</div>


</nav>









{/* HERO */}



<section className="
relative
min-h-screen
flex
items-center
pt-32
">



<div className="
absolute
w-[700px]
h-[700px]
bg-yellow-500/20
blur-[180px]
rounded-full
right-[-200px]
top-20
"/>



<div className="
absolute
w-[400px]
h-[400px]
bg-orange-500/10
blur-[150px]
left-[-100px]
bottom-0
"/>








<div className="
max-w-7xl
mx-auto
px-6
grid
lg:grid-cols-2
gap-16
items-center
">






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
duration:1
}}

>


<div className="
inline-flex
items-center
gap-3
px-5
py-2
rounded-full
border
border-yellow-500/30
bg-yellow-500/10
text-yellow-400
text-sm
mb-8
">

✨ নতুন লাক্সারি কালেকশন

</div>





<h1 className="
text-6xl
md:text-8xl
font-black
leading-[.9]
">

ঐতিহ্যের

<br/>

নতুন

<br/>

সংজ্ঞা

</h1>







<p className="
mt-8
text-gray-400
text-lg
leading-relaxed
max-w-xl
">

AVEN নিয়ে এসেছে বাংলাদেশের ঐতিহ্যবাহী
কুশিকথা, জামদানি এবং প্রিমিয়াম শালের
এক অনন্য লাক্সারি কালেকশন।
যেখানে ঐতিহ্য মিশেছে আধুনিক সৌন্দর্যের সাথে।

</p>








<div className="
flex
flex-wrap
gap-5
mt-10
">


<button className="
gold-btn
">

কালেকশন দেখুন

</button>



<button className="
px-10
py-4
rounded-full
border
border-yellow-500/40
hover:bg-yellow-500
hover:text-black
transition
">

সব পণ্য

</button>



</div>







<div className="
flex
gap-10
mt-14
">


<div>

<h3 className="
text-3xl
font-bold
text-yellow-400
">

১০০+

</h3>

<p className="
text-gray-500
">

ডিজাইন

</p>

</div>




<div>

<h3 className="
text-3xl
font-bold
text-yellow-400
">

১০০%

</h3>

<p className="
text-gray-500
">

প্রিমিয়াম

</p>

</div>



</div>





</motion.div>








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
h-[650px]
"

>



<div className="
absolute
inset-10
bg-yellow-500/20
blur-[100px]
rounded-full
"/>




<div className="
relative
h-full
rounded-[60px]
overflow-hidden
border
border-yellow-500/30
shadow-2xl
">


<Image

src="/products/hero.png"

fill

priority

alt="AVEN Luxury"

className="
object-cover
"

/>



<div className="
absolute
bottom-8
left-8
right-8
glass
p-5
">


<p className="
text-yellow-400
font-bold
">

AVEN Exclusive

</p>


<p className="
text-gray-300
text-sm
mt-2
">

Premium Fashion House

</p>


</div>



</div>




</motion.div>






</div>


</section>{/* COLLECTION SECTION */}


<section

id="collections"

className="
py-32
px-6
relative
"

>


<div className="
absolute
w-[400px]
h-[400px]
bg-yellow-500/10
blur-[150px]
right-0
"/>




<div className="
max-w-7xl
mx-auto
">


<div className="
text-center
mb-16
">


<p className="
text-yellow-400
tracking-[6px]
text-sm
">

আমাদের সংগ্রহ

</p>


<h2 className="
text-5xl
md:text-6xl
font-black
mt-5
">

লাক্সারি কালেকশন

</h2>


</div>






<div className="
grid
md:grid-cols-3
gap-8
">



{


[


{
title:"কুশিকথা",
desc:"ঐতিহ্যবাহী নকশা ও আধুনিক সৌন্দর্যের সমন্বয়"
},


{
title:"জামদানি",
desc:"হাতে তৈরি অসাধারণ শিল্পকর্মের পরিচয়"
},


{
title:"প্রিমিয়াম শাল",
desc:"আরাম ও আভিজাত্যের বিশেষ সংগ্রহ"
}



].map((item,index)=>(



<motion.div


key={index}


whileHover={{
y:-15
}}


className="
luxury-card
p-10
text-center
"

>


<div className="
w-20
h-20
mx-auto
rounded-full
bg-yellow-500/10
border
border-yellow-500/30
flex
items-center
justify-center
text-3xl
text-yellow-400
">


{index===0 && "🌿"}

{index===1 && "✨"}

{index===2 && "🧣"}


</div>






<h3 className="
text-3xl
font-bold
text-yellow-400
mt-7
">

{item.title}

</h3>





<p className="
text-gray-400
mt-4
leading-relaxed
">

{item.desc}

</p>




<button className="
mt-8
px-7
py-3
rounded-full
border
border-yellow-500/40
hover:bg-yellow-500
hover:text-black
transition
">

দেখুন

</button>



</motion.div>



))


}



</div>



</div>



</section>









{/* PRODUCTS SECTION */}



<section

id="products"

className="
py-32
px-6
bg-gradient-to-b
from-[#080808]
to-[#0d0b05]
"

>


<div className="
max-w-7xl
mx-auto
">


<div className="
text-center
mb-16
">


<p className="
text-yellow-400
tracking-[6px]
text-sm
">

AVEN COLLECTION

</p>



<h2 className="
text-5xl
md:text-6xl
font-black
mt-5
">

আমাদের পণ্য

</h2>


<p className="
text-gray-400
mt-5
max-w-xl
mx-auto
">

আপনার পছন্দের প্রিমিয়াম পোশাক
নির্বাচন করুন।

</p>


</div>







<ProductGrid/>





</div>



</section>









{/* WHY AVEN */}



<section

className="
py-32
px-6
"

>


<div className="
max-w-6xl
mx-auto
grid
md:grid-cols-3
gap-8
">





{


[

{
icon:"👑",
title:"প্রিমিয়াম মান",
desc:"সেরা কাপড় ও নিখুঁত ফিনিশিং"
},


{
icon:"✨",
title:"বিশেষ ডিজাইন",
desc:"ঐতিহ্য ও আধুনিকতার মেলবন্ধন"
},


{
icon:"🚚",
title:"নিরাপদ ডেলিভারি",
desc:"দ্রুত ও নির্ভরযোগ্য সেবা"
}


].map((item,index)=>(



<div

key={index}

className="
glass
p-8
text-center
"


>


<div className="
text-5xl
">

{item.icon}

</div>



<h3 className="
text-2xl
font-bold
text-yellow-400
mt-5
">

{item.title}

</h3>




<p className="
text-gray-400
mt-3
">

{item.desc}

</p>



</div>



))



}




</div>



</section>









{/* ORDER CTA */}



<section

className="
px-6
pb-32
"


>


<div className="
max-w-5xl
mx-auto
luxury-card
p-12
text-center
"

>


<h2 className="
text-4xl
md:text-5xl
font-black
">

আপনার পছন্দের পোশাক
আজই অর্ডার করুন

</h2>



<p className="
text-gray-400
mt-5
">

AVEN এর সাথে যোগ করুন আপনার
স্টাইলের নতুন পরিচয়।

</p>




<button className="
gold-btn
mt-8
">

অর্ডার করুন

</button>



</div>


</section>









{/* FOOTER */}



<footer

id="contact"

className="
border-t
border-yellow-500/20
bg-black
py-16
px-6
text-center
"

>


<h2 className="
text-5xl
font-black
tracking-[15px]
text-yellow-400
">

AVEN

</h2>




<p className="
text-gray-400
mt-5
">

প্রিমিয়াম ফ্যাশন হাউস

</p>




<div className="
flex
justify-center
gap-8
mt-8
text-gray-500
">


<span>
Facebook
</span>


<span>
Instagram
</span>


<span>
Contact
</span>


</div>





<p className="
text-gray-600
mt-10
">

© 2026 AVEN. সর্বস্বত্ব সংরক্ষিত।

</p>




</footer>





</main>


);


}