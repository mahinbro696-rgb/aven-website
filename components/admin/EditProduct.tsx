"use client";


import {
useEffect,
useState
} from "react";


import Image from "next/image";


import {
motion
} from "framer-motion";


import {
db,
storage
} from "@/lib/firebase";



import {
collection,
getDocs,
query,
orderBy,
doc,
updateDoc,
deleteDoc
} from "firebase/firestore";



import {
ref,
uploadBytes,
getDownloadURL
} from "firebase/storage";





interface Color{

name:string;

image:string;

}




interface Product{


id:string;

name:string;

category:string;

oldPrice:number;

discount:number;

price:number;

description:string;

mainImage:string;

colors:Color[];

}









export default function EditProduct(){



const [products,setProducts]=useState<Product[]>([]);


const [loading,setLoading]=useState(true);


const [selected,setSelected]=useState<Product|null>(null);







const loadProducts=async()=>{


try{


setLoading(true);



const q=query(

collection(db,"products"),

orderBy(
"createdAt",
"desc"
)

);



const snap=await getDocs(q);



const data=snap.docs.map(item=>({

id:item.id,

...item.data()

})) as Product[];




setProducts(data);



}

catch(error){


console.log(error);


}

finally{


setLoading(false);


}


};







useEffect(()=>{


loadProducts();


},[]);










const deleteProduct=async(id:string)=>{


const ok=confirm(
"Delete this product?"
);



if(!ok)return;




await deleteDoc(

doc(
db,
"products",
id
)

);




setProducts(prev=>

prev.filter(
x=>x.id!==id
)

);


};











return(


<div>


<h2 className="
text-4xl
font-bold
text-yellow-400
mb-8
">

Edit Products

</h2>







{

loading ?


<p>
Loading products...
</p>


:



<div className="
grid
md:grid-cols-3
gap-6
">


{


products.map(product=>(


<motion.div


key={product.id}


whileHover={{
y:-8
}}


className="
bg-zinc-950
border
border-yellow-500/20
rounded-3xl
overflow-hidden
"


>


<div className="
relative
h-64
">


<Image

src={product.mainImage}

fill

alt={product.name}

className="
object-cover
"

/>


</div>







<div className="
p-5
">


<h3 className="
text-2xl
font-bold
">

{product.name}

</h3>




<p className="
text-yellow-400
mt-2
">

৳ {product.price}

</p>






<div className="
flex
gap-3
mt-5
">


<button

onClick={()=>setSelected(product)}

className="
bg-yellow-500
text-black
px-5
py-2
rounded-full
font-bold
"

>

Edit

</button>






<button

onClick={()=>deleteProduct(product.id)}

className="
bg-red-600
px-5
py-2
rounded-full
"

>

Delete

</button>



</div>





</div>





</motion.div>



))


}



</div>



}









{

selected &&


<EditModal

product={selected}

close={()=>setSelected(null)}

refresh={loadProducts}


/>


}





</div>


);


}function EditModal({

product,

close,

refresh


}:{

product:Product;

close:()=>void;

refresh:()=>void;

}){



const [form,setForm]=useState<Product>(product);



const [saving,setSaving]=useState(false);



const [imageFile,setImageFile]=useState<File|null>(null);



const [preview,setPreview]=useState(
product.mainImage
);








const uploadImage=async(file:File)=>{


const imageRef=ref(

storage,

`products/${Date.now()}-${file.name}`

);



await uploadBytes(

imageRef,

file

);



return await getDownloadURL(

imageRef

);


};










const handleChange=(e:any)=>{


const {
name,
value
}=e.target;



const updated:any={

...form,

[name]:value

};





if(
name==="oldPrice" ||
name==="discount"
){


const old=

name==="oldPrice"

?

Number(value)

:

Number(form.oldPrice);





const discount=

name==="discount"

?

Number(value)

:

Number(form.discount);





updated.price=

String(

old -

(
old *
discount /
100
)

);


}




setForm(updated);


};









const saveUpdate=async()=>{


try{


setSaving(true);



let mainImage=form.mainImage;



if(imageFile){


mainImage=

await uploadImage(
imageFile
);


}





await updateDoc(

doc(
db,
"products",
product.id
),

{


name:form.name,


category:form.category,


oldPrice:Number(
form.oldPrice
),


discount:Number(
form.discount
),


price:Number(
form.price
),


description:form.description,


mainImage,


colors:form.colors


}

);





alert(
"Product Updated Successfully"
);



close();

refresh();



}

catch(error){


console.log(error);


alert(
"Update Failed"
);


}

finally{


setSaving(false);


}


};









const updateColor=(

index:number,

value:string

)=>{


const copy=[...form.colors];


copy[index].name=value;


setForm({

...form,

colors:copy

});


};










const addColor=()=>{


setForm({

...form,


colors:[

...form.colors,


{

name:"New Color",

image:""

}


]


});


};











const removeColor=(index:number)=>{


setForm({

...form,


colors:

form.colors.filter(

(_,i)=>i!==index

)


});


};











return(


<div className="

fixed

inset-0

z-50

bg-black/80

backdrop-blur-sm

flex

items-center

justify-center

p-5

">






<motion.div


initial={{

scale:.8,

opacity:0

}}


animate={{

scale:1,

opacity:1

}}


className="

bg-zinc-950

border

border-yellow-500/30

rounded-3xl

w-full

max-w-4xl

max-h-[90vh]

overflow-y-auto

p-8

"

>






<button

onClick={close}

className="

float-right

bg-red-600

px-4

py-2

rounded-full

"

>

✕

</button>






<h2 className="

text-3xl

font-bold

text-yellow-400

mb-8

">

Update Product

</h2>









<div className="space-y-5">





<input

name="name"

value={form.name}

onChange={handleChange}

placeholder="Product Name"

className="aven-input"

/>







<select

name="category"

value={form.category}

onChange={handleChange}

className="aven-input"

>

<option>
Kushikatha
</option>

<option>
Jamdani
</option>

<option>
Premium Shawl
</option>


</select>







<input

name="oldPrice"

value={form.oldPrice}

onChange={handleChange}

placeholder="Old Price"

className="aven-input"

/>







<input

name="discount"

value={form.discount}

onChange={handleChange}

placeholder="Discount %"

className="aven-input"

/>







<input

value={form.price}

readOnly

className="aven-input bg-zinc-800"

/>









<textarea

value={form.description}

onChange={(e)=>

setForm({

...form,

description:e.target.value

})

}

className="aven-input h-32"

placeholder="Description"

/>









<div>


<Image

src={preview}

width={200}

height={200}

alt="preview"

className="rounded-2xl object-cover"

/>




<input

type="file"

accept="image/*"

onChange={(e)=>{


const file=e.target.files?.[0];


if(file){


setImageFile(file);


setPreview(

URL.createObjectURL(file)

);


}


}}

/>



</div>










<h3 className="

text-2xl

font-bold

text-yellow-400

mt-8

">

Colors

</h3>








{

form.colors?.map((color,index)=>(



<div

key={index}

className="

bg-black

rounded-2xl

p-5

flex

gap-4

items-center

"

>



<input

value={color.name}

onChange={(e)=>

updateColor(

index,

e.target.value

)

}

className="aven-input"

/>







<button

onClick={()=>removeColor(index)}

className="

bg-red-600

px-4

py-2

rounded-full

"

>

Delete

</button>




</div>


))


}









<button

onClick={addColor}

className="

bg-yellow-500

text-black

px-5

py-3

rounded-full

font-bold

"

>

+ Add Color

</button>









<button

onClick={saveUpdate}

disabled={saving}

className="

w-full

mt-8

bg-yellow-500

text-black

py-4

rounded-full

font-bold

"

>


{

saving

?

"Saving..."

:

"Save Changes"

}



</button>





</div>






</motion.div>





</div>


);


}