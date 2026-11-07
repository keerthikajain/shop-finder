"""Category definitions shared by validation, imports and the interface."""
COLLECTIONS = [
 {'id':'clothing','name':'Clothing outlet','hi':'कपड़ों का आउटलेट','subtitle':'Every size, in its place.','icon':'shirt','fields':['size','colour','material'],'example':'Blue T-shirt size M and black jeans size 32','hint':'नीली टीशर्ट M और काली जीन्स 32'},
 {'id':'footwear','name':'Footwear stockroom','hi':'जूते का स्टॉकरूम','subtitle':'Find the right pair.','icon':'shoe','fields':['size_uk','colour','material'],'example':'White trainers size 7 and black sandals size 6','hint':'सफेद जूते 7 और काली सैंडल 6'},
 {'id':'appliances','name':'Appliance warehouse','hi':'घरेलू उपकरण गोदाम','subtitle':'From the shelf to the shop floor.','icon':'appliance','fields':['power_w','capacity_l','colour'],'example':'Mixer 750 W and kettle 1.5 L','hint':'मिक्सर 750 वाट और केतली 1.5 लीटर'},
 {'id':'home','name':'Home essentials','hi':'घर की ज़रूरी चीज़ें','subtitle':'Small things. Easy to find.','icon':'box','fields':['capacity_l','material','colour','size'],'example':'Storage box 20 L and cotton towel','hint':'स्टोरेज बॉक्स 20 लीटर और सूती तौलिया'},
]
COLLECTION_MAP={c['id']:c for c in COLLECTIONS}
LOCATION_FIELDS=['facility','floor','zone','aisle','rack','shelf','bin']
FIELD_LABELS={'size':'Size','size_uk':'Size (UK)','colour':'Colour','material':'Material','power_w':'Power (W)','capacity_l':'Capacity (L)'}

def demo_items():
 groups={
 'clothing':[
 ('Blue T-shirt',['t shirt','tee','नीली टीशर्ट','टीशर्ट','neeli tshirt'],'T-shirts',{'size':'M','colour':'blue','material':'cotton'}),
 ('Blue T-shirt',['t shirt','tee','नीली टीशर्ट','टीशर्ट'],'T-shirts',{'size':'L','colour':'blue','material':'cotton'}),
 ('White T-shirt',['t shirt','सफेद टीशर्ट'],'T-shirts',{'size':'M','colour':'white','material':'cotton'}),
 ('Black jeans',['jeans','काली जीन्स','जीन्स'],'Jeans',{'size':'32','colour':'black','material':'denim'}),
 ('Black jeans',['jeans','काली जीन्स','जीन्स'],'Jeans',{'size':'34','colour':'black','material':'denim'}),
 ('Green hoodie',['hoodie','हुडी'],'Hoodies',{'size':'L','colour':'green','material':'cotton'}),
 ('Beige trousers',['trousers','pants','पैंट'],'Trousers',{'size':'32','colour':'beige','material':'cotton'}),
 ('Red dress',['dress','ड्रेस'],'Dresses',{'size':'S','colour':'red','material':'viscose'})],
 'footwear':[
 ('White trainers',['trainers','sneakers','सफेद जूते','जूते'],'Trainers',{'size_uk':'7','colour':'white','material':'mesh'}),
 ('White trainers',['trainers','sneakers','सफेद जूते','जूते'],'Trainers',{'size_uk':'8','colour':'white','material':'mesh'}),
 ('Black sandals',['sandals','काली सैंडल','सैंडल'],'Sandals',{'size_uk':'6','colour':'black','material':'synthetic'}),
 ('Black sandals',['sandals','काली सैंडल','सैंडल'],'Sandals',{'size_uk':'7','colour':'black','material':'synthetic'}),
 ('Blue running shoes',['running shoes','दौड़ने के जूते'],'Running shoes',{'size_uk':'9','colour':'blue','material':'mesh'}),
 ('Brown loafers',['loafers','लोफर'],'Loafers',{'size_uk':'8','colour':'brown','material':'synthetic'}),
 ('Pink slippers',['slippers','चप्पल'],'Slippers',{'size_uk':'5','colour':'pink','material':'foam'}),
 ('Grey trainers',['trainers','ग्रे जूते'],'Trainers',{'size_uk':'6','colour':'grey','material':'mesh'})],
 'appliances':[
 ('Mixer grinder',['mixer','मिक्सर','मिक्सी'],'Kitchen',{'power_w':'750','capacity_l':'1.5','colour':'white'}),
 ('Mixer grinder',['mixer','मिक्सर','मिक्सी'],'Kitchen',{'power_w':'500','capacity_l':'1','colour':'white'}),
 ('Electric kettle',['kettle','केतली'],'Kitchen',{'power_w':'1500','capacity_l':'1.5','colour':'silver'}),
 ('Electric kettle',['kettle','केतली'],'Kitchen',{'power_w':'1800','capacity_l':'1.8','colour':'black'}),
 ('Steam iron',['iron','इस्त्री'],'Laundry',{'power_w':'1200','colour':'blue'}),
 ('Table fan',['fan','पंखा'],'Cooling',{'power_w':'55','colour':'white'}),
 ('Toaster',['toaster','टोस्टर'],'Kitchen',{'power_w':'800','colour':'black'}),
 ('Rice cooker',['rice cooker','चावल कुकर'],'Kitchen',{'power_w':'700','capacity_l':'1.8','colour':'white'})],
 'home':[
 ('Storage box',['box','storage box','स्टोरेज बॉक्स','डिब्बा'],'Storage',{'capacity_l':'20','material':'plastic','colour':'clear'}),
 ('Storage box',['box','storage box','स्टोरेज बॉक्स','डिब्बा'],'Storage',{'capacity_l':'40','material':'plastic','colour':'clear'}),
 ('Cotton towel',['towel','सूती तौलिया','तौलिया'],'Bath',{'material':'cotton','colour':'blue','size':'70 x 140 cm'}),
 ('Steel water bottle',['water bottle','bottle','बोतल'],'Kitchen',{'capacity_l':'1','material':'steel','colour':'silver'}),
 ('Dinner plate set',['plate','plates','प्लेट'],'Dining',{'material':'ceramic','colour':'white','size':'set of 6'}),
 ('Laundry basket',['basket','टोकरी'],'Storage',{'capacity_l':'35','material':'plastic','colour':'grey'}),
 ('Cotton bedsheet',['bedsheet','चादर'],'Bedding',{'material':'cotton','colour':'beige','size':'double'}),
 ('Cushion cover',['cushion','कुशन'],'Living',{'material':'cotton','colour':'green','size':'40 x 40 cm'})]}
 for group,rows in groups.items():
  prefix={'clothing':'CLO','footwear':'SHO','appliances':'APP','home':'HOM'}[group]
  for i,(name,aliases,category,specs) in enumerate(rows,1):
   p={'facility':'Demo Hub','zone':{'clothing':'Apparel','footwear':'Footwear','appliances':'Appliances','home':'Home'}[group],'aisle':str(1+(i-1)//4),'rack':chr(65+(i-1)//2),'shelf':str(1+(i-1)%2),'bin':f'{i:02}'}
   yield {'sku':f'{prefix}-{i:03}','collection':group,'name':name,'aliases':aliases,'category':category,'brand':{'clothing':'Everyday','footwear':'Northline','appliances':'Hearth','home':'Nest'}[group],'specs':specs,'barcode':f'DEMO-{prefix}-{i:03}','placements':[p],'synthetic':True}
