import { CollectionResponse } from 'sitefinity-react-framework/sdk/dto/collection-response';
import { SdkItem } from 'sitefinity-react-framework/sdk/dto/sdk-item';
import { BreadcrumbEntity } from '@/components/breadcrumb/breadcrumb';
import { BreadcrumbRestService } from '@/components/breadcrumb/breadcrumb.service';

export class MockedBreadcrumbRestService extends BreadcrumbRestService {

    static override getItems(): {value: CollectionResponse<SdkItem>[]} {

       return { value: [
        {
          Id: 'BB5A88C0-1B1C-49F2-9258-0A092FD636C9',
          ParentId: null,
          Title: 'Home',
          HasChildren: false,
          AvailableLanguages: [],
          Breadcrumb: [],
          IsHomePage: false,
          ViewUrl: '/home',
          PageType: 'Standard',
          Children: []
        },
        {
          Id: '334E2CB3-8346-4F9E-B1DF-F1FFB45F4C4C',
          ParentId: null,
          Title: 'react new',
          HasChildren: false,
          AvailableLanguages: [],
          Breadcrumb: [],
          IsHomePage: false,
          ViewUrl: '/react-new',
          PageType: 'Standard',
          Children: []
        }
      ] as any };
    }
}
